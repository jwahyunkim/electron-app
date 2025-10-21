import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1217',
    database: 'csg_main',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0
});

export async function getConnection() {
  return pool.getConnection();   
}
