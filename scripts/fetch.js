(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const path = require('path')
  const fetch = require('node-fetch')
  const mkdirp = require('mkdirp')
  const Octokit = require("@octokit/rest")
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  const now = new Date()
  const dest = `../data/${now.getUTCFullYear()}/${now.getUTCMonth()}/${now.getUTCDate()}.json`
  const latest = `../data/latest.json`
  const dir = dest.split('/').slice(0, -1).join('/')
  let repositories = []
  function writeFile (data) {
    mkdirp(path.resolve(__dirname, dir), function (err) {
      if (err) console.error(err)
      fs.writeFileSync(path.resolve(__dirname, dest), JSON.stringify(data), 'utf8')
      fs.writeFileSync(path.resolve(__dirname, latest), JSON.stringify(data), 'utf8')
    })
  }
  function run (page, cb) {
    page = page || 1
    octokit.repos
      .listForOrg({
        org: 'npm',
        type: 'public',
        per_page: 100,
        page: page
      }).then(({ data }) => {
        if (!data || !data.length) {
          repositories = repositories.filter(r => !r.archived)
          Promise.all(repositories.map(async r => {
            try {
              let status = await octokit.repos.listStatusesForRef({
                owner: 'npm',
                repo: r.name,
                ref: r.default_branch
              })
              let prs = await octokit.pulls.list({
                owner: 'npm',
                repo: r.name,
                per_page: 100
              })
              let issues = await octokit.issues.listForRepo({
                owner: 'npm',
                repo: r.name,
                per_page: 100
              })
              let response = await fetch(`https://raw.githack.com/npm/${r.name}/master/package.json`)
              let pkg = await response.json()
              r.prs_count = prs.data.length
              r.issues_count = issues.data.length
              r.build_status = status.data[0].state
              r.node = pkg && pkg.engines && pkg.engines.node ? pkg.engines.node : null
              r.license.key = pkg.license || r.license.key
              r.version = pkg.version
              return r
            } catch (e) {
              console.log(e)
            }
            return r
          })).then(cb)
        } else {
          page++
          repositories = repositories.concat(data)
          run(page, cb)
        }
      })
  }
  run(null, writeFile)
})()