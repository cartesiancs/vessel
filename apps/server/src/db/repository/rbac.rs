use std::collections::HashMap;

use crate::{
    db::models::{
        NewPermission, NewRole, NewRolePermission, NewUserRole, Permission, Role, RolePermission,
        RoleWithPermissions,
    },
    state::DbPool,
};
use diesel::prelude::*;

pub fn create_role_with_permissions(
    pool: &DbPool,
    name: &str,
    description: Option<&str>,
    permission_ids: &[i32],
) -> Result<Role, anyhow::Error> {
    use crate::db::schema::{role_permissions, roles};

    let mut conn = pool.get()?;

    conn.transaction(|conn| {
        let new_role = NewRole { name, description };

        let role: Role = diesel::insert_into(roles::table)
            .values(&new_role)
            .get_result(conn)?;

        if !permission_ids.is_empty() {
            let new_permissions: Vec<NewRolePermission> = permission_ids
                .iter()
                .map(|pid| NewRolePermission {
                    role_id: role.id,
                    permission_id: *pid,
                })
                .collect();

            diesel::insert_into(role_permissions::table)
                .values(&new_permissions)
                .execute(conn)?;
        }

        Ok(role)
    })
}

pub fn update_role_with_permissions(
    pool: &DbPool,
    role_id_to_update: i32,
    name: &str,
    description: Option<&str>,
    permission_ids: &[i32],
) -> Result<Role, anyhow::Error> {
    use crate::db::schema::{role_permissions, roles};

    let mut conn = pool.get()?;

    conn.transaction(|conn| {
        let role_data = NewRole { name, description };
        let updated_role = diesel::update(roles::table.find(role_id_to_update))
            .set(&role_data)
            .get_result::<Role>(conn)?;

        diesel::delete(
            role_permissions::table.filter(role_permissions::role_id.eq(role_id_to_update)),
        )
        .execute(conn)?;

        if !permission_ids.is_empty() {
            let new_permissions: Vec<NewRolePermission> = permission_ids
                .iter()
                .map(|pid| NewRolePermission {
                    role_id: role_id_to_update,
                    permission_id: *pid,
                })
                .collect();

            diesel::insert_into(role_permissions::table)
                .values(&new_permissions)
                .execute(conn)?;
        }

        Ok(updated_role)
    })
}

pub fn get_all_roles(pool: &DbPool) -> Result<Vec<Role>, anyhow::Error> {
    use crate::db::schema::roles::dsl::*;
    let mut conn = pool.get()?;
    let all_roles = roles.select(Role::as_select()).load(&mut conn)?;
    Ok(all_roles)
}

pub fn delete_role(pool: &DbPool, role_id: i32) -> Result<usize, anyhow::Error> {
    use crate::db::schema::roles::dsl::*;
    let mut conn = pool.get()?;
    let num_deleted = diesel::delete(roles.find(role_id)).execute(&mut conn)?;
    Ok(num_deleted)
}

pub fn create_permission(
    pool: &DbPool,
    new_permission: NewPermission,
) -> Result<Permission, anyhow::Error> {
    use crate::db::schema::permissions::dsl::*;
    let mut conn = pool.get()?;
    let permission = diesel::insert_into(permissions)
        .values(&new_permission)
        .get_result(&mut conn)?;
    Ok(permission)
}

pub fn get_all_permissions(pool: &DbPool) -> Result<Vec<Permission>, anyhow::Error> {
    use crate::db::schema::permissions::dsl::*;
    let mut conn = pool.get()?;
    let all_permissions = permissions
        .select(Permission::as_select())
        .load(&mut conn)?;
    Ok(all_permissions)
}

pub fn assign_role_to_user(
    pool: &DbPool,
    target_user_id: i32,
    target_role_id: i32,
) -> Result<(), anyhow::Error> {
    use crate::db::schema::user_roles::dsl::*;
    let mut conn = pool.get()?;
    let new_user_role = NewUserRole {
        user_id: target_user_id,
        role_id: target_role_id,
    };
    diesel::insert_into(user_roles)
        .values(&new_user_role)
        .execute(&mut conn)?;
    Ok(())
}

pub fn remove_role_from_user(
    pool: &DbPool,
    target_user_id: i32,
    target_role_id: i32,
) -> Result<usize, anyhow::Error> {
    use crate::db::schema::user_roles::dsl::*;
    let mut conn = pool.get()?;
    let num_deleted = diesel::delete(
        user_roles.filter(user_id.eq(target_user_id).and(role_id.eq(target_role_id))),
    )
    .execute(&mut conn)?;
    Ok(num_deleted)
}

pub fn get_user_roles(pool: &DbPool, target_user_id: i32) -> Result<Vec<Role>, anyhow::Error> {
    use crate::db::schema::{roles, user_roles};
    let mut conn = pool.get()?;
    let user_assigned_roles = user_roles::table
        .inner_join(roles::table)
        .filter(user_roles::user_id.eq(target_user_id))
        .select(Role::as_select())
        .load(&mut conn)?;
    Ok(user_assigned_roles)
}

pub fn grant_permission_to_role(
    pool: &DbPool,
    target_role_id: i32,
    target_permission_id: i32,
) -> Result<(), anyhow::Error> {
    use crate::db::schema::role_permissions::dsl::*;
    let mut conn = pool.get()?;
    let new_role_permission = NewRolePermission {
        role_id: target_role_id,
        permission_id: target_permission_id,
    };

    diesel::insert_into(role_permissions)
        .values(&new_role_permission)
        .execute(&mut conn)?;
    Ok(())
}

pub fn revoke_permission_from_role(
    pool: &DbPool,
    target_role_id: i32,
    target_permission_id: i32,
) -> Result<usize, anyhow::Error> {
    use crate::db::schema::role_permissions::dsl::*;
    let mut conn = pool.get()?;
    let num_deleted = diesel::delete(
        role_permissions.filter(
            role_id
                .eq(target_role_id)
                .and(permission_id.eq(target_permission_id)),
        ),
    )
    .execute(&mut conn)?;
    Ok(num_deleted)
}

pub fn get_role_permissions(
    pool: &DbPool,
    target_role_id: i32,
) -> Result<Vec<Permission>, anyhow::Error> {
    use crate::db::schema::{permissions, role_permissions};
    let mut conn = pool.get()?;
    let role_granted_permissions = role_permissions::table
        .inner_join(permissions::table)
        .filter(role_permissions::role_id.eq(target_role_id))
        .select(Permission::as_select())
        .load(&mut conn)?;
    Ok(role_granted_permissions)
}

pub fn get_all_roles_with_permissions(
    pool: &DbPool,
) -> Result<Vec<RoleWithPermissions>, anyhow::Error> {
    let mut conn = pool.get()?;

    let roles_list = crate::db::schema::roles::table.load::<Role>(&mut conn)?;

    let permissions_list = crate::db::schema::permissions::table.load::<Permission>(&mut conn)?;

    let role_permissions_list =
        RolePermission::belonging_to(&roles_list).load::<RolePermission>(&mut conn)?;

    let permissions_map: HashMap<i32, Permission> =
        permissions_list.into_iter().map(|p| (p.id, p)).collect();

    let results = roles_list
        .into_iter()
        .map(|role| {
            let permissions_for_role = role_permissions_list
                .iter()
                .filter(|rp| rp.role_id == role.id)
                .filter_map(|rp| permissions_map.get(&rp.permission_id).cloned())
                .collect();

            RoleWithPermissions {
                id: role.id,
                name: role.name.clone(),
                description: role.description.clone(),
                permissions: permissions_for_role,
            }
        })
        .collect();

    Ok(results)
}
