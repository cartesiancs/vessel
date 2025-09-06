
CREATE TABLE map_layers (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_user_id INTEGER NOT NULL,
    is_visible INTEGER NOT NULL DEFAULT 1 CHECK(is_visible IN (0, 1)), 
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE map_features (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    layer_id INTEGER NOT NULL,
    feature_type VARCHAR(10) NOT NULL CHECK(feature_type IN ('POINT', 'LINE', 'POLYGON')), 
    name VARCHAR(255),
    style_properties TEXT,
    created_by_user_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(layer_id) REFERENCES map_layers(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);


CREATE TABLE map_vertices (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    feature_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL,
    sequence INTEGER NOT NULL,
    FOREIGN KEY(feature_id) REFERENCES map_features(id) ON DELETE CASCADE
);