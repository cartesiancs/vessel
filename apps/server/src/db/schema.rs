// @generated automatically by Diesel CLI.

diesel::table! {
    device_tokens (id) {
        id -> Integer,
        device_id -> Integer,
        token_hash -> Text,
        expires_at -> Nullable<Timestamp>,
        last_used_at -> Nullable<Timestamp>,
        created_at -> Timestamp,
    }
}

diesel::table! {
    devices (id) {
        id -> Integer,
        device_id -> Text,
        name -> Nullable<Text>,
        manufacturer -> Nullable<Text>,
        model -> Nullable<Text>,
    }
}

diesel::table! {
    entities (id) {
        id -> Integer,
        entity_id -> Text,
        device_id -> Nullable<Integer>,
        friendly_name -> Nullable<Text>,
        platform -> Nullable<Text>,
        entity_type -> Nullable<Text>,
    }
}

diesel::table! {
    entities_configurations (id) {
        id -> Integer,
        entity_id -> Integer,
        configuration -> Text,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    events (event_id) {
        event_id -> Integer,
        event_type -> Nullable<Text>,
        event_data -> Nullable<Text>,
        origin -> Nullable<Text>,
        time_fired -> Nullable<Timestamp>,
    }
}

diesel::table! {
    flow_versions (id) {
        id -> Integer,
        flow_id -> Integer,
        version -> Integer,
        graph_json -> Text,
        comment -> Nullable<Text>,
        created_at -> Timestamp,
    }
}

diesel::table! {
    flows (id) {
        id -> Integer,
        name -> Text,
        description -> Nullable<Text>,
        enabled -> Integer,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    map_features (id) {
        id -> Integer,
        layer_id -> Integer,
        feature_type -> Text,
        name -> Nullable<Text>,
        style_properties -> Nullable<Text>,
        created_by_user_id -> Integer,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    map_layers (id) {
        id -> Integer,
        name -> Text,
        description -> Nullable<Text>,
        owner_user_id -> Integer,
        is_visible -> Integer,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    map_vertices (id) {
        id -> Integer,
        feature_id -> Integer,
        latitude -> Float,
        longitude -> Float,
        altitude -> Nullable<Float>,
        sequence -> Integer,
    }
}

diesel::table! {
    permissions (id) {
        id -> Integer,
        name -> Text,
        description -> Nullable<Text>,
    }
}

diesel::table! {
    role_permissions (role_id, permission_id) {
        role_id -> Integer,
        permission_id -> Integer,
    }
}

diesel::table! {
    roles (id) {
        id -> Integer,
        name -> Text,
        description -> Nullable<Text>,
    }
}

diesel::table! {
    states (state_id) {
        state_id -> Integer,
        metadata_id -> Nullable<Integer>,
        state -> Nullable<Text>,
        attributes -> Nullable<Text>,
        last_changed -> Nullable<Timestamp>,
        last_updated -> Nullable<Timestamp>,
        created -> Nullable<Timestamp>,
    }
}

diesel::table! {
    states_meta (metadata_id) {
        metadata_id -> Integer,
        entity_id -> Text,
    }
}

diesel::table! {
    system_configurations (id) {
        id -> Integer,
        key -> Text,
        value -> Text,
        enabled -> Integer,
        description -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    user_roles (user_id, role_id) {
        user_id -> Integer,
        role_id -> Integer,
    }
}

diesel::table! {
    users (id) {
        id -> Integer,
        username -> Text,
        email -> Text,
        password_hash -> Text,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::joinable!(device_tokens -> devices (device_id));
diesel::joinable!(entities -> devices (device_id));
diesel::joinable!(entities_configurations -> entities (entity_id));
diesel::joinable!(flow_versions -> flows (flow_id));
diesel::joinable!(map_features -> map_layers (layer_id));
diesel::joinable!(map_features -> users (created_by_user_id));
diesel::joinable!(map_layers -> users (owner_user_id));
diesel::joinable!(map_vertices -> map_features (feature_id));
diesel::joinable!(role_permissions -> permissions (permission_id));
diesel::joinable!(role_permissions -> roles (role_id));
diesel::joinable!(states -> states_meta (metadata_id));
diesel::joinable!(user_roles -> roles (role_id));
diesel::joinable!(user_roles -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    device_tokens,
    devices,
    entities,
    entities_configurations,
    events,
    flow_versions,
    flows,
    map_features,
    map_layers,
    map_vertices,
    permissions,
    role_permissions,
    roles,
    states,
    states_meta,
    system_configurations,
    user_roles,
    users,
);
