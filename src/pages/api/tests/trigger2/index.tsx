import type { NextApiRequest, NextApiResponse } from 'next'
import { exec } from 'child_process'
import { ResponseData } from '@/types';

/*
https://www.graperank.tech/api/tests/trigger2
*/
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    // const { stdout, stderr } = exec('node /src/api/tests/trigger2/test_script.js'); // doesn't work
    // const { stdout, stderr } = exec('node /api/tests/trigger2/test_script.js'); // doesn't work
    // const { stdout, stderr } = exec('node api/tests/trigger2/test_script.js'); // doesn't work
    // const { stdout, stderr } = exec('node test_script.js'); // doesn't work
    // const { stdout, stderr } = exec('node src/pages/api/tests/trigger2/test_script.js'); // WORKS!!
    // const { stdout, stderr } = exec('node src/algos/test_script.js') // WORKS!!
    const { stdout, stderr } = exec('node src/pages/api/tests/trigger2/test_script_sql.mjs');

    const response:ResponseData = {
      success: true,
      message: `api/tests/trigger2 data:`,
      data: {
        stdout,
        stderr
      }
    }
    res.status(200).json(response)
  } catch (error) {
    console.log(error)
    const response:ResponseData = {
      success: false,
      message: `api/tests/trigger2 data:`,
      data: {
       error
      }
    }
    res.status(500).json(response)
  }
}