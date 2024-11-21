import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = {
  message: string
}
 
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: `api Hello from Next.js!!!` })
}

/*
sequence:

delete s3 data

https://www.graperank.tech/api/sql/deleteTables

https://www.graperank.tech/api/sql/initializeTables

for each customer:
https://graperank.tech/api/nostr/listeners/singleUser?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

trigger all of these repeatedly:
https://www.graperank.tech/api/dataManagement/transferEventsToEventsTableFromS3?n=10
s3:

https://www.graperank.tech/api/dataManagement/events/processKind3Events?n=10
sql: SELECT * FROM events where kind=3 and flaggedForProcessing=1;
(super fast, should be able to do a lot at once)

https://www.graperank.tech/api/dataManagement/users/processKind3Events?n=10
sql: select * from users WHERE flaggedForKind3EventProcessing=1;
(slow; n=10 took maybe 30-45 sec ??? )

https://www.graperank.tech/api/dataManagement/users/updateNeo4jNode?n=10
sql: SELECT * FROM users where flaggedToUpdateNeo4jNode=1;

https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollows?n=1

https://graperank.tech/api/nostr/listeners/multipleUsers?n=10&kind0EventId=true&kind3EventId&kind10000EventId=true

*/