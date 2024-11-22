import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

/*
https://grapeRank.tech/api/stats/overview
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
  const connection = await mysql.createConnection({
    host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: process.env.AWS_MYSQL_USER,
    password: process.env.AWS_MYSQL_PWD,
    database: process.env.AWS_MYSQL_DB,
  });

  try {
    const sql2 = ` SELECT * FROM events where kind=3 and flaggedForProcessing=1 `
    const results_sql2 = await connection.query(sql2);
    const aEvents2 = JSON.parse(JSON.stringify(results_sql2[0]))

    const sql3 = `SELECT * from users WHERE flaggedForKind3EventProcessing=1;`
    const results_sql3 = await connection.query(sql3);
    const aUsers3= JSON.parse(JSON.stringify(results_sql3[0]))

    const sql4 = `SELECT * FROM users where flaggedToUpdateNeo4jNode=1;`
    const results_sql4 = await connection.query(sql4);
    const aUsers4= JSON.parse(JSON.stringify(results_sql4[0]))

    const sql5 = `SELECT * FROM users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0;`
    const results_sql5 = await connection.query(sql5);
    const aUsers5= JSON.parse(JSON.stringify(results_sql5[0]))

    const sql6 = `SELECT * FROM users WHERE whenLastListened IS NULL;`
    const results_sql6 = await connection.query(sql6);
    const aUsers6= JSON.parse(JSON.stringify(results_sql6[0]))

    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)

    const response:ResponseData = {
      success: true,
      message: `api/stats/overview data:`,
      data: {
        cronJob2: {
          numEventsToProcess: aEvents2.length,
          sql2,
          description: '',
        },
        cronJob3: {
          numUsersToProcess: aUsers3.length,
          sql3,
          description: '',
        },
        cronJob4: {
          numUsersToProcess: aUsers4.length,
          sql4,
          description: '',
        },
        cronJob5: {
          numUsersToProcess: aUsers5.length,
          sql5,
          description: '',
        },
        cronJob6: {
          numUsersToProcess: aUsers6.length,
          sql6,
          description: '',
        }
      }
    }
    res.status(200).json(response)
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/stats/overview error: ${error}!`,
    }
    res.status(500).json(response)
  }
}