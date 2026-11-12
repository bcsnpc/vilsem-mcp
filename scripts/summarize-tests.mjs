import fs from 'node:fs/promises'
const file=process.argv[2]??'test-results.json'
let summary
try{
 const data=JSON.parse(await fs.readFile(file,'utf8')),skipped=data.testResults.flatMap(suite=>suite.assertionResults.filter(test=>['pending','skipped','todo'].includes(test.status)).map(test=>test.fullName))
 summary=`Tests: ${data.numPassedTests} passed, ${data.numFailedTests} failed, ${skipped.length} skipped.\n`
 summary+=skipped.length?'\nSkipped tests (browser checks require a local Chrome/Edge/Chromium executable and optional playwright-core):\n'+skipped.map(name=>`- ${name}`).join('\n')+'\n':'\nNo tests skipped.\n'
}catch(error){summary=`Test result summary unavailable: ${error.message}\n`;process.exitCode=1}
process.stdout.write(summary)
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary)
