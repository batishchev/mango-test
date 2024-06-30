import express from 'express';
import { query } from './database/db.js';
import { execute } from './redis.js';

const table = '"user"';
const fields = [
  ['id'], // одинакого и в sql и в объекте
  ['first_name', 'firstName'], // в sql - snake_case, в объектах camelCase
  ['last_name', 'lastName'], // в sql - snake_case, в объектах camelCase
  ['login'],
  ['email'],
  ['phone']
];

export interface IUser {
  id: number;
  firstName?: string;
  lastName?: string;
  login?: string;
  email?: string;
  phone?: string;
}

// Список всех sql полей
const sqlFields: string[] = fields.map(([v]) => v);
// Маппер sql поля в поле объекта
const sqlFieldMapper = (() => {
  const hash = Object.fromEntries(fields.map(([key, value]) => [key, value || key]));
  return (name: string): string => hash[name];
})();
// Разбить объект в соответствии с sql полями
const splitObject = (value: any, sqlFields: string[]) => {
  const objectFields = sqlFields.map(sqlFieldMapper);
  const objectValues = objectFields.map((key) => value[key]);
  return [objectFields, objectValues];
};
// Собрать объект из ключей и значений
const combineObject = (fields: string[], values: any[]) => Object.fromEntries(fields.map((k, i) => [k, values[i]]));
// Заменить sql ключи в объекте
const mapSqlObject = (value: any): any =>
  Object.fromEntries(Object.entries(value).map(([k, v]) => [sqlFieldMapper(k), v]));

// Кэшер
async function cacheUser(user: IUser) {
  await execute((client) => client.SET(`user:${user.id}`, JSON.stringify(user)));
}
// Доставатор из кэша
async function uncacheUser(id: number): Promise<IUser> {
  return JSON.parse(await execute((client) => client.GET(`user:${id}`)));
}

export async function create(user: Omit<IUser, 'id'>): Promise<IUser> {
  const fields = sqlFields.filter((v) => v !== 'id'); // Все поля без id
  const placeholder = new Array(fields.length).fill('?'); // Куча знаков вопроса ?, ?, ?, ?
  const [_, values] = splitObject(user, fields); // Значения из переданного аргумента
  const sqlRes = await query(`INSERT INTO ${table} (${fields}) VALUES (${placeholder}) RETURNING id,${fields}`, values);
  const result = mapSqlObject(sqlRes.rows[0]) as IUser;

  cacheUser(result);

  return result;
}

export async function update(user: IUser): Promise<IUser> {
  const fields = sqlFields.filter((v) => v !== 'id');
  const placeholder = fields.map((key) => `${key} = ?`);
  const [oFields, values] = splitObject(user, fields);

  await query(`UPDATE ${table} SET ${placeholder} WHERE id = ?`, [...values, user.id]);

  // Не будем выполнять второй запрос, а соберём объект из переданных данных
  const result = { id: user.id, ...combineObject(oFields, values) } as IUser;

  cacheUser(result);

  return result;
}

export async function get(user: Pick<IUser, 'id'>): Promise<IUser> {
  try {
    return await uncacheUser(user.id);
  } catch (e) {}

  const fields = sqlFields;
  const result = await query(`SELECT ${fields} FROM ${table} WHERE id = ?`, [user.id]);

  return mapSqlObject(result.rows[0]);
}

export async function getList(n: number, offset: number): Promise<IUser[]> {
  const fields = sqlFields;
  const result = await query(`SELECT ${fields} FROM ${table} LIMIT ? OFFSET ?`, [n, offset]);

  return result.rows.map(mapSqlObject);
}

export function expressRoutes() {
  const router = express.Router();

  router.post('/add', async (req, res) => {
    try {
      const user = await create(req.body);
      res.send(JSON.stringify(user)).status(200).end();
    } catch (e) {
      res.send(e).status(500).end();
    }
  });
  router.post('/update', async (req, res) => {
    try {
      const user = await update(req.body);
      res.send(JSON.stringify(user)).status(200).end();
    } catch (e) {
      res.send(e).status(500).end();
    }
  });
  router.post('/get', async (req, res) => {
    try {
      const user = await get(req.body);
      res.send(JSON.stringify(user)).status(200).end();
    } catch (e) {
      res.send(e).status(500).end();
    }
  });
  router.post('/getList', async (req, res) => {
    try {
      const users = await getList(req.body.n, req.body.offset);
      res.send(JSON.stringify(users)).status(200).end();
    } catch (e) {
      res.send(e).status(500).end();
    }
  });

  return router;
}
