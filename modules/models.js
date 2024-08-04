const createUserTable = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    fullname VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    email VARCHAR(255) UNIQUE
  );
`;

const createExpensesTable = `
  CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    amount FLOAT,
    description TEXT,
    date DATE,
    user_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`;

module.exports = {
  createUserTable,
  createExpensesTable,
};
