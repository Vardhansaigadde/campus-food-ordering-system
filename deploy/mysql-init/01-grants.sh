#!/bin/sh
# Runs once, on the very first start of an empty MySQL volume.
# Creates the 4 service databases and lets the app user (not root) use only those.
set -e
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS auth_db;
CREATE DATABASE IF NOT EXISTS restaurant_db;
CREATE DATABASE IF NOT EXISTS order_db;
CREATE DATABASE IF NOT EXISTS notification_db;
GRANT ALL PRIVILEGES ON auth_db.*         TO '$MYSQL_USER'@'%';
GRANT ALL PRIVILEGES ON restaurant_db.*   TO '$MYSQL_USER'@'%';
GRANT ALL PRIVILEGES ON order_db.*        TO '$MYSQL_USER'@'%';
GRANT ALL PRIVILEGES ON notification_db.* TO '$MYSQL_USER'@'%';
FLUSH PRIVILEGES;
SQL
