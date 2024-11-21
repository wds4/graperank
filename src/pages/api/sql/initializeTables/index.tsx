import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

/*
https://www.graperank.tech/api/sql/initializeTables
*/

type ResponseData = {
  success: boolean,
  message: string,
  data?: object,
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
    try {
      const connection = await mysql.createConnection({
        host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
        port: 3306,
        user: process.env.AWS_MYSQL_USER,
        password: process.env.AWS_MYSQL_PWD,
        database: process.env.AWS_MYSQL_DB,
      });

      let command1 = `CREATE TABLE IF NOT EXISTS events ( `
      command1 += ` id INT NOT NULL AUTO_INCREMENT, `
      command1 += ` pubkey VARCHAR(255) NOT NULL, `
      command1 += ` eventId VARCHAR(255) NOT NULL UNIQUE, `
      command1 += ` created_at INT NOT NULL, `
      command1 += ` kind INT NOT NULL, `
      command1 += ` flaggedForProcessing INT NOT NULL DEFAULT 1, `
      command1 += ` whenRowAdded INT NOT NULL DEFAULT 0, `
      command1 += ` PRIMARY KEY (id) `
      command1 += ` ); `
      const results1 = await connection.query(command1);
      console.log(results1);

      let command2 = ` CREATE TABLE IF NOT EXISTS users ( `
      command2 += ` id INT NOT NULL AUTO_INCREMENT, `
      command2 += ` pubkey VARCHAR(255) NOT NULL UNIQUE, `
      command2 += ` kind0EventId VARCHAR(255), `
      command2 += ` kind3EventId VARCHAR(255), `
      command2 += ` kind10000EventId VARCHAR(255), `
      command2 += ` whenLastListened int, `
      command2 += ` flaggedForKind3EventProcessing INT NOT NULL DEFAULT 0, `
      command2 += ` flaggedToUpdateNeo4jNode INT NOT NULL DEFAULT 0, `
      command2 += ` flaggedToUpdateNeo4jFollows INT NOT NULL DEFAULT 0, `
      command2 += ` flaggedToUpdateNeo4jMutes INT NOT NULL DEFAULT 0, `
      command2 += ` flaggedToUpdateNeo4jReports INT NOT NULL DEFAULT 0, `
      command2 += ` whenRowAdded INT NOT NULL DEFAULT 0, `
      command2 += ` PRIMARY KEY (id) `
      command2 += ` ); `
      const results2 = await connection.query(command2);
      console.log(results2);

      const command3 = ` CREATE TABLE IF NOT EXISTS customers ( 
id INT NOT NULL AUTO_INCREMENT, 
pubkey VARCHAR(255) NOT NULL UNIQUE, 
whenSignedUp INT NOT NULL DEFAULT 0,
PRIMARY KEY (id)
); `
      const results3 = await connection.query(command3);
      console.log(results3);

      const response:ResponseData = {
        success: true,
        message: `api/sql/initializeTables data:`,
        data: {
          results1, results2, results3
        }
      }
      res.status(200).json(response)
    } catch (error) {
      console.log(`error: ${JSON.stringify(error)}`)
      const response:ResponseData = {
        success: false,
        message: `api/sql/initializeTables error: ${error}!`,
      }
      res.status(500).json(response)
    }
}