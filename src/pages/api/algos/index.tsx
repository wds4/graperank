import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = {
  message: string
}
 
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: 'api/algos Hello from Next.js!' })
}

/*
For each customer, expect the following files in S3:
customerData/<pk_customer>/dos
customerData/<pk_customer>/personalizedPageRank
customerData/<pk_customer>/personalizedGrapeRank

each object is formatted:
{
  metaData: {
    whenLastUpdated: <unix timestamp>
  },
  data: {
  },
}
*/