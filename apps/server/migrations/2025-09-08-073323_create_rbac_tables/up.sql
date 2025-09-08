CREATE TABLE roles (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE, -- ex: 'admin', 'editor', 'viewer'
    description TEXT
);

CREATE TABLE permissions (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE, -- ex: 'users:create', 'devices:edit', 'flows:view'
    description TEXT
);

CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE
);