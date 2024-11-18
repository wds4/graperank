import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

/*
- select * from events where kind=3 and flaggedForProcessing=1
- for each row:
  - select kind3EventId from users where pubkey;
  - get event from s3 using key: events/<kind3EventId>
  - if timestamp is more recent, then:
    - update users set kind3eventId, flagForKind3EventProcessing=1 where pubkey;
    - update events set flaggedForProcessing=0 where kind3EventId

usage:

http://localhost:3000/api/dataManagement/events/processKind3Events?n=3

https://www.graperank.tech/api/dataManagement/events/processKind3Events?n=3

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
    const command_sql = ` SELECT * FROM events where kind=3 and flaggedForProcessing=1 `
    const results_events = await connection.query(command_sql);
    console.log(results_events);
    const aEvents = results_events[0]

    const command_sql_none = ` SELECT * FROM events where kind=3 and flaggedForProcessing=1 `
    const results_events_none = await connection.query(command_sql_none);





    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/events/processKind3Events data:`,
      data: { 
        aEvents, results_events,results_events_none
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/events/processKind3Events error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}