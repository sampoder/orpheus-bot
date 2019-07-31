const Botkit = require('botkit')
const Airtable = require('airtable')
const _ = require('lodash')

const base = new Airtable({apiKey: process.env.AIRTABLE_KEY}).base(process.env.AIRTABLE_BASE);

const redisConfig = {
  url: process.env.REDISCLOUD_URL
}
const redisStorage = require('botkit-storage-redis')(redisConfig)

console.log("reticulating splines...")
console.log("booting dinosaur...")

const controller = new Botkit.slackbot({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  clientSigningSecret: process.env.SLACK_CLIENT_SIGNING_SECRET,
  scopes: ['bot', 'chat:write:bot'],
  storage: redisStorage
});

controller.startTicking()

controller.setupWebserver(process.env.PORT, function(err,webserver) {
  controller.createWebhookEndpoints(controller.webserver)
  controller.createOauthEndpoints(controller.webserver)
});

controller.hears('checkin', 'direct_message,direct_mention', (bot, message) => {
  const { text, user } = message

  // ignore threaded messages
  if (_.has(message.event, 'parent_user_id')) return

  bot.replyInThread(message, "I'll send you a check-in right now!")

  bot.startConversationInThread(message, (err, convo) => {
    if(err) {console.log(err)}

    convo.say({
      delay: 2000,
      text: `Give me a sec... let me pull up my database`
    })
    convo.say({
      delay: 2000,
      text: `*typewriter noises*`
    })

    getInfoForUser(user).then(({leader, club, history}) => {
      if (leader) {
        convo.say({
          delay: 2000,
          text: `Found you! It's **${leader.fields['Full Name']}**, right?`
        })
        if (club) {
          convo.say({
            delay: 2000,
            text: `From ${club.fields['Name']}`
          })
        } else {
          convo.say({
            delay: 4000,
            text: `Hmmm.... I don't see a club record under your name`
          })
        }
      } else {
        convo.say({
          delay: 2000,
          text: `I don't have any record of you being a club leader (ಠ_ಠ)`
        })
      }
    })
  })
})

controller.on('slash_command', (bot, message) => {
  const { command, text, user } = message
  console.log(`Received ${command} command from user ${user}`)

  const loadingMessage = _.sample([
    'chugging the data juice',
    'crunching the numbers',
    'gurgling the bits',
    'juggling the electrons',
    'reticulating the splines',
    'rolling down data hills',
    'skiing the data slopes',
    'zooming through the cyber-pipes',
    'grabbing the stats'
  ])

  switch (command) {
    case '/stats':
      bot.replyAcknowledge()
      bot.replyAndUpdate(message, `:beachball: _${loadingMessage}_`, (err, src, updateResponse) => {
        if (err) console.error(err)
        getInfoForUser(user).then(info => {
          setTimeout(() => {
            if (!info.leader) {
              updateResponse("You aren't a club leader")
            }

            const content = {
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `Stats for *${info.club.fields['Name']}*`
                  }
                },
                {
                  type: 'divider'
                },
                {
                  type: "image",
                  title: {
                    type: "plain_text",
                    text: "attendance"
                  },
                  image_url: graphUrl(info),
                  alt_text: "attendance"
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: info.history.filter(h => h.fields['Attendance']).map(h => `- meeting w/ ${h.fields['Attendance']} members on ${h.fields['Date']}`).join('\n')
                    // text: `${info.history.filter(h => h.fields['Attendance']).length} meetings recorded`
                  }
                }
              ]
            }
            console.log(graphUrl(info))
            updateResponse(content, err => {
              console.error(err)
            })
          }, 2000)
        }).catch(err => console.error(err))
      })
      break;
  
    default:
      bot.replyPrivate(message, `I don't know how to do that ¯\_(ツ)_/¯`)
      break;
  }
})

controller.hears('hello', ['ambient'], function(bot, msg) {
  // send a message back: "hellp"
  bot.replyAndUpdate(msg, 'hellp', function(err, src, updateResponse) {
    if (err) console.error(err);
    // oh no, "hellp" is a typo - let's update the message to "hello"
    setTimeout(() => {
      updateResponse('hello', function(err) {
        console.error(err)
      });
    }, 5000)
  });
})

// catch-all
controller.hears('.*', 'direct_message,direct_mention', (bot, message) => {
  const { text, user } = message

  // ignore threaded messages
  if (_.has(message.event, 'parent_user_id')) return

  const response = _.sample([
    `*slowly blinks one eye*`,
    `*stares off into the distance, dazed*`,
    `*eyes slowly glaze over in boredom*`,
    `*tilts head in confusion*`,
    `*UWU*`
  ])

  bot.replyInThread(message, response)
})

const getLeaderFrom = user => new Promise((resolve, reject) => {
  base('Leaders').select({
    filterByFormula: `{Slack ID} = "${user}"`
  }).firstPage((err, records) => {
    if (err) {
      console.error(err)
      reject(err)
    }
    resolve(records[0])
  })
})

const getClubFrom = leader => new Promise((resolve, reject) => {
  if (!leader) {resolve(null)}
  base('Clubs').select({
    filterByFormula: `SEARCH("${leader.fields['ID']}", ARRAYJOIN(Leaders))`
  }).firstPage((err, records) => {
    if (err) {
      console.error(err)
      reject(err)
    }
    resolve(records[0])
  })
})

const getHistoryFrom = club => new Promise((resolve, reject) => {
  const result = []
  if (!club) {resolve(null)}
  base('History').select({
    filterByFormula: `Club = "${club.fields['ID']}"`
  }).eachPage((records, fetchNextPage) => {
    records.forEach(record => result.push(record))
    fetchNextPage()
  }, err => {
    console.log(result, err)
    if (err) {reject(err)}
    resolve(result)
  })
})

const getInfoForUser = user => new Promise((resolve, reject) => {
  const results = {}
  
  getLeaderFrom(user)
    .then(leader => results.leader = leader)
    .then(() => getClubFrom(results.leader))
    .then(club => results.club = club)
    .then(() => getHistoryFrom(results.club))
    .then(history => results.history = history)
    .then(() => resolve(results))
    .catch(e => reject(e))
})

const graphUrl = info => {
  const config = {
    type: 'bar',
    data: {
      labels: ['January', 'February', 'March', 'April', 'May'],
      datasets: [{
        label: info.club.fields['Name'],
        data: [ 50, 60, 70, 180, 190 ]
      }]
    }
  }
  return encodeURI(`https://quickchart.io/chart?width=500&height=300&c=${JSON.stringify(config)}`)
}