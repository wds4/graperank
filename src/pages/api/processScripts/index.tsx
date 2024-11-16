import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = {
  message: string
}
 
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: `api/processScripts Hello from Next.js!` })
}

/*
1. listener writes events to s3 under: unprocessedEvents
2. processNewEvents adds event to sql table: events if not already present and moves s3 file out of unprocessedEvents folder into events folder
3. process kind3 events
- select * from events where kind=3 and flaggedForProcessing=1
- for each row:
  - select kind3EventId from users where pubkey;
  - get event from s3 using key: events/<kind3EventId>
  - if timestamp is more recent, then:
    - update users set kind3eventId, flagForKind3EventProcessing=1 where pubkey;
    - update events set flaggedForProcessing=0 where kind3EventId
4. 
*/