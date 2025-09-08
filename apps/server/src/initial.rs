use diesel::{
    ExpressionMethods, OptionalExtension, QueryDsl, RunQueryDsl, SelectableHelper, SqliteConnection,
};
use tracing::info;

use crate::db::models::{NewPermission, Permission, User};
use crate::{
    db::models::{NewSystemConfiguration, NewUser, SystemConfiguration},
    hash::hash_password,
};

pub fn create_initial_admin(conn: &mut SqliteConnection) {
    use crate::db::schema::users::dsl::*;

    let admin_username = "admin";

    let admin_exists = users
        .filter(username.eq(admin_username))
        .select(User::as_select())
        .first::<User>(conn)
        .optional()
        .expect("Error checking for admin user");

    if admin_exists.is_none() {
        let password = "admin";

        info!("Admin user not found. Creating...");

        match hash_password(password) {
            Ok(hashed_password) => {
                let new_admin = NewUser {
                    username: admin_username,
                    email: "admin@example.com",
                    password_hash: &hashed_password,
                };

                diesel::insert_into(users)
                    .values(&new_admin)
                    .execute(conn)
                    .expect("Error creating admin user");

                info!("Admin user '{}' created.", admin_username);
            }
            Err(e) => eprintln!("error: {}", e),
        }
    } else {
        info!("Admin user already exists. Skipping creation.");
    }
}

pub fn create_initial_configurations(conn: &mut SqliteConnection) {
    use crate::db::schema::system_configurations::dsl::{key, system_configurations};

    let default_configs = vec![
        (
            "mqtt_broker_url",
            "localhost:1883",
            "Default MQTT Broker URL. Format: host:port",
        ),
        ("rtp_broker_port", "0.0.0.0:5004", "RTP port"),
        (
            "turn_server_config",
            r#"{ "urls": "turn:turn.example.com:3478", "username": "user", "credential": "pass" }"#,
            "Default WebRTC TURN Server configuration (JSON format)",
        ),
    ];

    for (k, v, d) in default_configs {
        let config_exists = system_configurations
            .filter(key.eq(k))
            .select(SystemConfiguration::as_select())
            .first::<SystemConfiguration>(conn)
            .optional()
            .expect("Error checking for system configuration");

        if config_exists.is_none() {
            info!("Configuration '{}' not found. Creating...", k);
            let new_config = NewSystemConfiguration {
                key: k,
                value: v,
                enabled: Some(0),
                description: Some(d),
            };

            diesel::insert_into(system_configurations)
                .values(&new_config)
                .execute(conn)
                .expect("Error creating system configuration");

            info!("Configuration '{}' created.", k);
        } else {
            info!("Configuration '{}' already exists. Skipping creation.", k);
        }
    }
}

pub fn seed_initial_permissions(conn: &mut SqliteConnection) {
    use crate::db::schema::permissions::dsl::{name, permissions};

    let initial_permissions = vec![
        ("users:create", "Allows creating new users"),
        ("users:read", "Allows viewing user list and details"),
        ("users:update", "Allows updating user information"),
        ("users:delete", "Allows deleting users"),
        ("users:assign_roles", "Allows assigning roles to users"),
        ("roles:create", "Allows creating new roles"),
        ("roles:read", "Allows viewing roles and their permissions"),
        (
            "roles:update",
            "Allows updating roles and their assigned permissions",
        ),
        ("roles:delete", "Allows deleting roles"),
        ("devices:create", "Allows creating new devices"),
        ("devices:read", "Allows viewing devices"),
        ("devices:update", "Allows updating device information"),
        ("devices:delete", "Allows deleting devices"),
        ("entities:create", "Allows creating new entities"),
        ("entities:read", "Allows viewing entities"),
        ("entities:update", "Allows updating entity information"),
        ("entities:delete", "Allows deleting entities"),
        ("flows:create", "Allows creating new flows"),
        ("flows:read", "Allows viewing flows"),
        ("flows:update", "Allows updating flows"),
        ("flows:delete", "Allows deleting flows"),
    ];

    info!("Seeding initial permissions...");

    for (perm_name, perm_desc) in initial_permissions {
        let permission_exists = permissions
            .filter(name.eq(perm_name))
            .select(Permission::as_select())
            .first::<Permission>(conn)
            .optional()
            .expect("Error checking for permission");

        if permission_exists.is_none() {
            info!("Permission '{}' not found. Creating...", perm_name);
            let new_permission = NewPermission {
                name: perm_name,
                description: Some(perm_desc),
            };

            diesel::insert_into(permissions)
                .values(&new_permission)
                .execute(conn)
                .expect("Error creating permission");

            info!("Permission '{}' created.", perm_name);
        } else {
            info!(
                "Permission '{}' already exists. Skipping creation.",
                perm_name
            );
        }
    }
    info!("Permission seeding complete.");
}
