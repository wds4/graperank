import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

/*
- select * from users where flagForKind3EventProcessing=1
for each pubkey_parent:
  - fetch full event from s3 bucket using kind3eventId
  - in neo4j, remove all follows emanating from pubkey_parent
  - cycle through pubkeys in kind3Event. for each pubkey_child:
    - sql: add to users table if not already present 
    - neo4j: add node if not already present
    - add follow relationship in neo4j
  - sql: in table: users, set flagForKind3EventProcessing = 0

usage:

http://localhost:3000/api/dataManagement/users/processKind3Events?n=3

https://www.graperank.tech/api/dataManagement/users/processKind3Events?n=3

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
  const searchParams = req.query
  let numEventsToProcess = 1;
  if (searchParams.n && typeof searchParams.n == 'string') {
    numEventsToProcess = Number(searchParams.n)
  }
  console.log(`numEventsToProcess: ${numEventsToProcess}`)

  const connection = await mysql.createConnection({
    host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: process.env.AWS_MYSQL_USER,
    password: process.env.AWS_MYSQL_PWD,
    database: process.env.AWS_MYSQL_DB,
  });

  try {
    const command_sql = ` SELECT * FROM users where flagForKind3EventProcessing=1 `
    const results1 = await connection.query(command_sql);
    console.log(results1);





    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/users/processKind3Events data:`,
      data: { 
        results1
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/users/processKind3Events error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}