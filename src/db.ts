import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host:               process.env.MYSQL_HOST     || 'localhost',
  port:               Number(process.env.MYSQL_PORT) || 3306,
  user:               process.env.MYSQL_USER     || 'root',
  password:           process.env.MYSQL_PASSWORD || '',
  database:           process.env.MYSQL_DATABASE || 'farmacia',
  waitForConnections: true,
  connectionLimit:    10,
  timezone:           'Z',
  typeCast(field, next) {
    if (field.type === 'TINY' && field.length === 1) {
      return field.string() === '1';
    }
    return next();
  },
});

export default pool;
