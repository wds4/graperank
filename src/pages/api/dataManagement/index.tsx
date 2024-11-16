import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = {
  message: string
}
 
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: `api/data
    Management Hello from Next.js!` })
}

/*
1. api/nostr/listeners/singleUser (this applies to all other listeners too)
  - create filter and connect to nostr relays
  - write events to s3 using key: unprocessedEventsByEventId/<eventId>
2. api/dataManagement/processNewEvents or /transferSingleEventToEventsTableFromS3
  - generate list of events in endpoint: unprocessedEventsByEventId/* 
  for each event:
    - if event already present in table: events, do nothing
    - if not already present, write event to sql table: events with flaggedForProcessing=1
    - in s3, move event from unprocessedEventsByEventId/ into processedEventsByEventId/
3. api/dataManagement/processKind3Events
- select * from events where kind=3 and flaggedForProcessing=1
- for each row:
  - select kind3EventId from users where pubkey;
  - get event from s3 using key: events/<kind3EventId>
  - if timestamp is more recent, then:
    - update users set kind3eventId, flagForKind3EventProcessing=1 where pubkey;
    - update events set flaggedForProcessing=0 where kind3EventId
4. 
*/