const debug = require('debug')('botium-connector-xatkit')
const io = require('socket.io-client')

const Capabilities = {
  XATKIT_SERVER_URL: 'XATKIT_SERVER_URL'
}

const Defaults = {
}

class BotiumConnectorXatkit {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
  }

  Validate () {
    debug('Validate called')
    this.caps = Object.assign({}, Defaults, this.caps)

    if (!this.caps[Capabilities.XATKIT_SERVER_URL]) {
      throw new Error('XATKIT_SERVER_URL capability required')
    }

    this.server = this.caps[Capabilities.XATKIT_SERVER_URL]
    const urlPattern = /(^https?:\/\/[^/]+)\/?(.*)/i

    this.parsedUrl = this.server.match(urlPattern)
    if (this.parsedUrl === null) {
      throw new Error('The provided URL ' + this.server + ' is not a valid URL')
    }
    return Promise.resolve()
  }

  Start () {
    debug('start called')
    let serverUrl = this.server
    let basePath = '/socket.io'
    if (this.parsedUrl.length !== null && this.parsedUrl.length === 3) {
      if (this.parsedUrl[2] !== '') {
        basePath = '/' + this.parsedUrl[2]
      }
      serverUrl = this.parsedUrl[1]
    }
    this.serverUrl = serverUrl
    this.basePath = basePath
    const socket = io(this.serverUrl, {
      path: this.basePath
    })
    this.socket = socket

    this.socket.on('bot_message', (message) => {
      const messageText = message.message
      const buttons = message.quickButtonValues && message.quickButtonValues.map(r => {
        return {
          text: r.label,
          payload: r.value
        }
      })
      if (messageText || buttons) {
        if (messageText) {
          debug('Bot says ' + messageText)
        }
        if (buttons && buttons.length > 0) {
          const buttonsText = buttons.map(b => {
            return b.text
          }).join(',')
          debug('Bot displays buttons ' + buttonsText)
        }
        const botMsg = { sender: 'bot', sourceData: message, messageText, buttons }
        this.queueBotSays(botMsg)
      } else {
        debug('Bot message received without text: ' + message)
      }
    })

    this.socket.on('link_snippet_with_img', (message) => {
      const { title, link, img } = message
      if (title && link && img) {
        debug('Bot sent link snippet with img', title, link, img)
        const messageText = `${title} > ${link}`
        const sourceData = `Link snippet with image: title: ${title}, link ${link}, image ${img}`
        const media = [
          {
            mediaUri: img
          }
        ]
        debug('Bot sent link snippet with img', title, link, img)
        const botMsg = { sender: 'bot', sourceData, messageText, media }
        this.queueBotSays(botMsg)
      } else {
        debug('Bot message received without text: ' + message)
      }
    })

    return new Promise((resolve, reject) => {
      this.socket.on('connect', function () {
        socket.emit('init', { hostname: 'botium.xatkit', url: 'http://botium.xatkit', origin: 'http://botium.xatkit' })
      })

      this.socket.on('init_confirm', () => {
        resolve()
      })

      this.socket.on('connect_error', function (err) {
        reject(err)
      })
      socket.on('connect_timeout', (timeout) => {
        reject(timeout)
      })
    })
  }

  UserSays ({ messageText, buttons }) {
    if (buttons && buttons.length > 0) {
      debug('User clicked on ' + messageText)
      const message = {
        selectedValue: messageText,
        username: 'test'
      }
      this.socket.emit('user_button_click', message)
    } else {
      debug('User wrote ' + messageText)
      const message = {
        message: messageText,
        username: 'test'
      }

      this.socket.emit('user_message', message)
    }
    return Promise.resolve()
  }

  Stop () {
    debug('Stop called')

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          this.socket.close()
          resolve()
        } catch (err) {
          reject(err)
        }
      }, 1000)
    })
  }
}

module.exports = BotiumConnectorXatkit
