"""Role-based access control. Roles map to fine-grained permissions; endpoints
depend on permissions, never on role names, so roles can be reshaped freely."""
from enum import Enum


class Role(str, Enum):
    super_admin = "super_admin"
    platform_admin = "platform_admin"
    verification_officer = "verification_officer"
    content_manager = "content_manager"
    finance_admin = "finance_admin"
    support_agent = "support_agent"
    org_admin = "org_admin"
    org_staff = "org_staff"
    member = "member"


PLATFORM_ROLES = {
    Role.super_admin, Role.platform_admin, Role.verification_officer,
    Role.content_manager, Role.finance_admin, Role.support_agent,
}
ORG_ROLES = {Role.org_admin, Role.org_staff}


class Perm(str, Enum):
    analytics_view = "analytics.view"
    users_view = "users.view"
    users_manage = "users.manage"
    identity_review = "identity.review"
    orgs_view = "orgs.view"
    orgs_manage = "orgs.manage"
    orgs_verify = "orgs.verify"
    opps_view = "opps.view"
    opps_review = "opps.review"
    opps_edit = "opps.edit"
    opps_publish = "opps.publish"
    apps_view = "apps.view"
    reports_manage = "reports.manage"
    plans_manage = "plans.manage"
    payments_view = "payments.view"
    announce_send = "announce.send"
    taxonomy_manage = "taxonomy.manage"
    directory_manage = "directory.manage"
    content_manage = "content.manage"
    staff_manage = "staff.manage"
    audit_view = "audit.view"


_ALL = set(Perm)

ROLE_PERMS: dict[Role, set[Perm]] = {
    Role.super_admin: _ALL,
    Role.platform_admin: _ALL - {Perm.staff_manage},
    Role.verification_officer: {
        Perm.analytics_view, Perm.users_view, Perm.identity_review, Perm.orgs_view, Perm.orgs_verify,
        Perm.opps_view, Perm.opps_review, Perm.opps_edit, Perm.apps_view, Perm.reports_manage, Perm.directory_manage,
    },
    Role.content_manager: {
        Perm.analytics_view, Perm.orgs_view, Perm.opps_view, Perm.opps_edit, Perm.opps_publish,
        Perm.taxonomy_manage, Perm.announce_send, Perm.directory_manage, Perm.content_manage,
    },
    Role.finance_admin: {Perm.analytics_view, Perm.users_view, Perm.plans_manage, Perm.payments_view, Perm.orgs_view},
    Role.support_agent: {
        Perm.users_view, Perm.orgs_view, Perm.opps_view, Perm.apps_view, Perm.reports_manage, Perm.payments_view,
    },
    Role.org_admin: set(),
    Role.org_staff: set(),
    Role.member: set(),
}


def perms_for(role: Role) -> set[Perm]:
    return ROLE_PERMS.get(role, set())


def is_platform(role: Role) -> bool:
    return role in PLATFORM_ROLES


def is_org(role: Role) -> bool:
    return role in ORG_ROLES
