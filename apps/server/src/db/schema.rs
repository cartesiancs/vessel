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
diesel::joinable!(states -> states_meta (metadata_id));

diesel::allow_tables_to_appear_in_same_query!(
    device_tokens,
    devices,
    entities,
    entities_configurations,
    events,
    states,
    states_meta,
    system_configurations,
    users,
);
