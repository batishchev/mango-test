CREATE TABLE "user" (
    id SERIAL PRIMARY KEY NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    login VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(100)
);