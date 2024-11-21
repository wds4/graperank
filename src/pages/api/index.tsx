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

https://graperank.tech/api/nostr/listeners/singleUser?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

https://www.graperank.tech/api/dataManagement/transferEventsToEventsTableFromS3?n=3

https://www.graperank.tech/api/dataManagement/events/processKind3Events?n=1

https://www.graperank.tech/api/dataManagement/users/processKind3Events?n=1

https://www.graperank.tech/api/dataManagement/users/updateNeo4jNode?n=5

https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollows?n=1

*/