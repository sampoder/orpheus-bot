import { getInfoForUser, recordMeeting } from '../utils'
import { parseDate } from 'chrono-node'
import { sample } from 'lodash'

const getTz = (bot, user) => new Promise((resolve, reject) => {
  bot.api.users.info({ user }, (err, res) => {
    if (err) {
      console.error(err)
      reject(err)
    }
    resolve(res.user.tz)
  })
})

const interactionCheckin = (bot, message) => {
  getTz(bot, message.user).then((timeZone) => {
    const log = (x) => {
      console.log(message.user, x)
    }

    bot.startConversation(message, (err, convo) => {
      if (err) {
        console.log(err)
      }

      convo.addMessage({
        delay: 500,
        text: `Give me a sec... let me pull up my database`
      })
      convo.addMessage({
        delay: 1000,
        text: `*typewriter noises*`
      })

      getInfoForUser(message.user).then(({
        leader,
        club,
        history
      }) => {
        if (!leader || !club) {
          convo.say({
            delay: 2000,
            text: `I don't have any record of you being a club leader (ಠ_ಠ)`
          })
          convo.stop()
          return
        }
        convo.addMessage({
          delay: 2000,
          text: `Found you! It's *${leader.fields['Full Name']}*, right?`
        }, 'found')
        convo.addMessage({
          delay: 2000,
          text: `From ${club.fields['Name']}`,
          action: 'date'
        }, 'found')

        convo.addMessage({
          delay: 1500,
          text: "You can see your meeting history with the `/stats` command"
        }, 'done')
        convo.addMessage({
          delay: 2000,
          text: sample([
            'done!',
            'finished!',
            'pleasure doing business with you!',
            'See ya!',
            'cya!',
            'aloha!',
            'bye!',
            'bye bye!',
            'come back soon!',
            'until next time!',
            'adios!'
          ])
        }, 'done')

        convo.addMessage({
          delay: 2000, 
          text: 'Ok, just to confirm...\n> Attendance: *{{vars.attendance}} hackers*\n> Meeting date: *{{vars.date.dayName}} ({{{vars.date.mmddyyyy}}})*'
        }, 'confirm')
        convo.addQuestion({
          text: 'Is this correct?',
          blocks: [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Just to double check, this is what I'm about to submit to your club history record"
            }
          },
          {
            "type": "actions",
            "elements": [{
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "✅ submit",
                  "emoji": true
                },
                "value": "submit"
              },
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "↩️ restart",
                  "emoji": true
                },
                "value": "restart"
              },
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "⛔️ cancel",
                  "emoji": true
                },
                "value": "cancel"
              }
            ]
          }]
        }, [{
          pattern: 'submit',
          callback: (response, convo) => {
            log('*user submitted their checkin!*')
            const reply = sample([
              'grins with delight',
              'fidgets in mild excitement',
              'fumbles around with her large stubby arms for a pencil and paper',
              'sifts through the Permian layer to find her notes'
            ])
            bot.replyInteractive(response, `_✅ You confirm everything is accurate as orpheus ${reply}._`)

            convo.say("I'll write it in my notepad...")
            const { date, attendance } = convo.vars
            recordMeeting(club, { date, attendance }, (meetingRecord) => {
              log(meetingRecord)
              convo.say({
                text: "Got it recorded",
                action: 'done'
              })
              convo.next()
            })
          }
        }, {
          pattern: 'restart',
          callback: (response, convo) => {
            log('*user wants to restart their checkin*')
            bot.replyInteractive(response, '_↩️ You ask orpheus to start again_')
            convo.gotoThread('found')
            convo.vars = {}
            convo.next()
          }
        }, {
          pattern: 'cancel',
          callback: (response, convo) => {
            log('*user clicked "cancel"*')

            const reply = sample([
              'She looks slightly crestfallen',
              'She promptly tears up the paper on her desk and eats it',
              'She tosses the notes on her desk into her mouth and starts chewing',
              '*VRRRRR* She raises her arm and swipes all the papers off the table into the hungry paper shredder lying by her table.',
            ])
            bot.replyInteractive(response, `_⛔ You ask orpheus to cancel the checkin. ${reply}._`)
            convo.gotoThread('done')
          }
        }], {}, 'confirm')

        convo.addMessage('What day was your meeting on?', 'date')
        convo.addQuestion({
          text: 'When was your meeting?',
          blocks: [{
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "(You can tell me a date in `YYYY-MM-DD` format, say things like `last tuesday`, or click a shortcut button"
              }
            },
            {
              "type": "actions",
              "elements": [{
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": `Today`
                },
                "value": 'today'
              }]
            }
          ]
        }, [
          {
            default: true,
            callback: (response, convo) => {
              // attempt to parse
              const meetingDate = parseDate(`${response.text} ${timeZone}`)
              if (Object.prototype.toString.call(meetingDate) === '[object Date]') {
                bot.replyInteractive(response, `_You tell orpheus you met ${response.text}_`)
                convo.setVar('date', {
                  full: meetingDate,
                  dayName: meetingDate.toLocaleDateString('en-us', { weekday: 'long', timeZone }),
                  mmddyyyy: meetingDate.toLocaleDateString('en-us', {timeZone})
                })
                convo.say({
                  text: `Ok, I'll record that you met *{{vars.date.dayName}} ({{{vars.date.mmddyyyy}}})*`,
                  action: 'attendance'
                })
              convo.next()
              } else {
                console.log(response, convo)
                convo.repeat()
              }
            }
          }
        ], {}, 'date')

        convo.addQuestion(`How many people showed up? (please just enter digits– I'm fragile)`, (response, convo) => {
          const attendance = +response.text

          if (attendance > 0 && attendance % 1 === 0) {
            log(`*User said they had "${response.text}" in attendance, which is valid`)
            convo.setVar('attendance', attendance)
            convo.say({
              text: `I parsed that as *{{vars.attendance}}* hackers`,
              action: 'confirm'
            })
            convo.next()
          } else {
            log(`*User said they had "${response.text}" in attendance, which is invalid`)
            convo.say({
              text: "_orpheus scrunches her face, eyeing your input with suspicion. looks like that wasn't what she was looking for_"
            })
            convo.next()
            convo.repeat()
            convo.next()
          }
        }, {}, 'attendance')

        convo.gotoThread('found')
      })
    })
  })
}

export default interactionCheckin