// @generated automatically by Diesel CLI.

diesel::table! {
    custom_nodes (node_type) {
        node_type -> Text,
        data -> Text,
    }
}

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
    dynamic_dashboards (id) {
        id -> Text,
        name -> Text,
        layout -> Text,
        created_at -> Timestamp,
        updated_at -> Timestamp,
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
    streams (ssrc) {
        ssrc -> Integer,
        topic -> Text,
        device_id -> Text,
        media_type -> Text,
        created_at -> Timestamp,
        codec -> Text,
    }
}

diesel::table! {
    recordings (id) {
        id -> Integer,
        stream_ssrc -> Integer,
        topic -> Text,
        device_id -> Text,
        media_type -> Text,
        filename -> Text,
        file_path -> Text,
        file_size -> Integer,
        duration_ms -> Integer,
        status -> Text,
        started_at -> Timestamp,
        ended_at -> Nullable<Timestamp>,
        created_by_user_id -> Nullable<Integer>,
    }
}

diesel::table! {
    refresh_tokens (id) {
        id -> Integer,
        user_id -> Integer,
        family_id -> Text,
        token_hash -> Text,
        expires_at -> Timestamp,
        used_at -> Nullable<Timestamp>,
        created_at -> Timestamp,
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
diesel::joinable!(role_permissions -> permissions (permission_id));
diesel::joinable!(role_permissions -> roles (role_id));
diesel::joinable!(refresh_tokens -> users (user_id));
diesel::joinable!(states -> states_meta (metadata_id));
diesel::joinable!(user_roles -> roles (role_id));
diesel::joinable!(user_roles -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    custom_nodes,
    device_tokens,
    devices,
    dynamic_dashboards,
    entities,
    entities_configurations,
    events,
    flow_versions,
    flows,
    permissions,
    recordings,
    refresh_tokens,
    role_permissions,
    roles,
    states,
    states_meta,
    streams,
    system_configurations,
    user_roles,
    users,
);
