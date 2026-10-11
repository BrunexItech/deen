"""community maintenance fee replaces membership packages; website payment codes

Revision ID: 7c1e9a4d2b30
Revises: 150dda15a70c
Create Date: 2026-10-03 09:00:00
"""
from alembic import op


revision = '7c1e9a4d2b30'
down_revision = '150dda15a70c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'payment'")
    # One fee for everyone. It starts at KES 50 (the minimum); the super admin sets the
    # real amount in the Control Center. Old packages stay (inactive) only so
    # past payments and running memberships keep their history.
    op.execute("""
        INSERT INTO plans (id, code, name, tier, price_kes, interval_months, benefits, features, highlight,
                           active, sort, created_at, updated_at)
        SELECT gen_random_uuid()::text, 'community', 'Community maintenance fee', 'member',
               50, 1,
               ARRAY['Checking every organization and opportunity', 'Keeping DEEN free of scams',
                     'SMS alerts, servers and member support']::varchar[],
               '{"free_monthly_applications": 3}'::json, false, true, 0, now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'community')
    """)
    op.execute("UPDATE plans SET active = false WHERE code <> 'community'")
    op.execute("UPDATE opportunities SET access_tier = 'member' WHERE access_tier = 'premium'")
    op.execute("UPDATE announcements SET audience = 'members' WHERE audience = 'premium'")


def downgrade() -> None:
    op.execute("UPDATE plans SET active = true WHERE code <> 'community'")
    op.execute("UPDATE plans SET active = false WHERE code = 'community'")
