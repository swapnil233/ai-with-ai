from datetime import datetime, timedelta, timezone
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from models.base import Base
from models.user import User, Session as UserSession

# In the DB better-auth stores the plain token.
# The cookie carries "TOKEN.HMAC_SIGNATURE"; _extract_token strips the signature.
PLAIN_TEST_TOKEN = "test-session-token"
# Simulate signed cookie format: TOKEN.SIGNATURE
SIGNED_TEST_COOKIE = f"{PLAIN_TEST_TOKEN}.fakesignature"


# ---------------------------------------------------------------------------
# In-memory SQLite for tests
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_async_session = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


# SQLite needs foreign keys enabled explicitly
@event.listens_for(test_engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create all tables, yield a session, then drop everything."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_async_session() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Insert a test user and return it."""
    user = User(
        id="test-user-id",
        email="test@example.com",
        name="Test User",
        emailVerified=False,
        createdAt=datetime.now(timezone.utc),
        updatedAt=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_session(db_session: AsyncSession, test_user: User) -> UserSession:
    """Insert a valid session for test_user."""
    session = UserSession(
        id="test-session-id",
        userId=test_user.id,
        token=PLAIN_TEST_TOKEN,
        expiresAt=datetime.now(timezone.utc) + timedelta(days=7),
        ipAddress="127.0.0.1",
        userAgent="test-agent",
        createdAt=datetime.now(timezone.utc),
        updatedAt=datetime.now(timezone.utc),
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with DB dependency overridden."""
    from dependencies.database import get_db
    from main import app

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_client(
    db_session: AsyncSession, test_session: UserSession
) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client that sends a valid session cookie."""
    from dependencies.database import get_db
    from main import app

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    cookies = {"better-auth.session_token": SIGNED_TEST_COOKIE}
    async with AsyncClient(
        transport=transport, base_url="http://test", cookies=cookies
    ) as c:
        yield c

    app.dependency_overrides.clear()
