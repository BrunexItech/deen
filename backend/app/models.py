"""Imports every module's models so SQLAlchemy metadata (and Alembic) see all tables."""
from app.modules.announcements.models import *  # noqa: F401,F403
from app.modules.applications.models import *  # noqa: F401,F403
from app.modules.audit.models import *  # noqa: F401,F403
from app.modules.content.models import *  # noqa: F401,F403
from app.modules.directory.models import *  # noqa: F401,F403
from app.modules.files.models import *  # noqa: F401,F403
from app.modules.identity.models import *  # noqa: F401,F403
from app.modules.jobs.models import *  # noqa: F401,F403
from app.modules.moderation.models import *  # noqa: F401,F403
from app.modules.notifications.models import *  # noqa: F401,F403
from app.modules.opportunities.models import *  # noqa: F401,F403
from app.modules.orgs.models import *  # noqa: F401,F403
from app.modules.subscriptions.models import *  # noqa: F401,F403
from app.modules.taxonomy.models import *  # noqa: F401,F403
from app.modules.users.models import *  # noqa: F401,F403
