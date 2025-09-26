use std::collections::HashMap;

use crate::{
    db::{
        models::{
            NewPermission, NewRole, NewRolePermission, NewStream, NewUserRole, Permission, Role,
            RolePermission, RoleWithPermissions, Stream,
        },
        schema::streams,
    },
    state::DbPool,
};
use diesel::prelude::*;

pub fn get_all_streams(pool: &DbPool) -> Result<Vec<Stream>, anyhow::Error> {
    use crate::db::schema::streams::dsl::*;

    let mut conn = pool.get()?;
    let all_streams = streams.select(Stream::as_select()).load(&mut conn)?;
    Ok(all_streams)
}

pub fn upsert_stream(pool: &DbPool, new_stream: &NewStream) -> Result<Stream, anyhow::Error> {
    use crate::db::schema::streams;

    let mut conn = pool.get()?;

    let stream = diesel::insert_into(streams::table)
        .values(new_stream)
        .on_conflict((streams::topic, streams::device_id))
        .do_update()
        .set(streams::ssrc.eq(new_stream.ssrc))
        .get_result(&mut conn)?;

    Ok(stream)
}
