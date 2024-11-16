import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = {
  message: string
}
 
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: 'api/s3 Hello from Next.js!' })
}

/*
eventsByEventId/<eventId>
recentlyAddedEventsByEventId/<eventId>
*/