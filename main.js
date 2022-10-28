const { createApp } = Vue


let app = createApp({
  computed: {
    crypto: () => window.crypto
  },
  data() {
    return {
      userIDInput: '',
      userID: "",
      showUserID: "",
      backend: 'https://api.sms.voidnet.tech/',
      availableNumbers: "",
      credits: "",
      threads: [],
      ownedNumber: "Getting number...",
      numberPurchaseMessage: "",
      moneroAddress: 'Getting monero address...',
      darkMode: true,
      disableSMSSend: false,
      messageToSend: "",
      sendToNumber: "",
      showingThreadNum: "",
      threadOffset: 0,
      threadMessages: [],
      lastThreadLineHeader: 0,
      threadLineHeader: 0
    }
  },
  methods: {
    openThread(num){
      this.showingThreadNum = num
      this.threadOffset = 0
      this.threadMessages.length = 0
      this.threadLineHeader = 0
      this.lastThreadLineHeader = 0
      this.getThreadMessages(num)
    },
    getThreadMessages(num){
      if (!num){return}
      fetch(this.backend + this.userID + '/thread/' + num + '/' + Number(this.threadOffset).toString()).then(response => {
        if (response.ok) {
          this.threadLineHeader = parseInt(response.headers.get('x-total-lines'))
          return response.text()
        } else {
          throw new Error('Network response was not ok.')
        }
      }).then(messages => {
        if (this.lastThreadLineHeader === this.threadLineHeader){
          return
        }
        this.lastThreadLineHeader = this.threadLineHeader

        messages = messages.split('\n')
        if (messages.length > 0){
          for (let i = 0; i < messages.length; i++){
            if (messages[i] !== ''){
              this.threadMessages.push(messages[i])
            }
          }
          this.threadOffset = this.threadLineHeader
        }
      })
    },
    sendSMS(){
      this.disableSMSSend = true
      fetch(this.backend + this.userID + '/send/' + this.sendToNumber, {
        method: 'POST',
        body: this.messageToSend
      }).then(resp => {
        this.disableSMSSend = false
        if (resp.status === 200) {
          this.messageToSend = ""
        }
        else{
          console.debug(resp)
        }
      }).catch(err => {
        this.disableSMSSend = false
        console.log(err)
      })
      return false
    },
    getThreads(doInterval){
      let updateThreads = async (data) => {
        if (! this.userID || document.hidden){
          return
        }
        let response = await fetch(this.backend + this.userID + '/list')
        if (response.ok){
          let textResp = await response.text()
          if (! RegExp('You').test(textResp)){
            // Only update threads that changed
            let newThreads = textResp.split('\n')
            for (let i = 0; i < newThreads.length; i++){
              newThreads[i] = newThreads[i].trim()
              if (! this.threads.includes(newThreads[i])){
                if (newThreads[i]){
                  console.debug('added thread')
                  this.threads.push(newThreads[i])
                }
              }
            }
            let removeThreads = []
            for (let i = 0; i < this.threads.length; i++){
              this.threads[i] = this.threads[i].trim()
              if (! newThreads.includes(this.threads[i])){
                if (this.threads[i]){
                  removeThreads.push(this.threads[i])
                }
              }
            }
            for (let i = 0; i < removeThreads.length; i++){
              this.threads.splice(this.threads.indexOf(removeThreads[i]), 1)
            }
          }
        }
    }
    updateThreads()
    if (doInterval){setInterval(updateThreads, 10000)}
    },
    async buyNum(e){
      let numToBuy = e.target.dataset.number
      console.log("Buying number " + numToBuy)
      fetch(this.backend + this.userID + '/buynumber/' + numToBuy, {'method': 'POST'}).catch((err) => {
        console.log(err)
        this.numberPurchaseMessage = "Error purchasing number"
      }).then((res) =>{
        if (res.ok) {
          console.log("Number bought")
          this.ownedNumber = numToBuy
          this.numberPurchaseMessage = "Successfully purchased number"
        } else {
          if (res.status === 402){
            console.debug("Not enough credits")
            this.numberPurchaseMessage = "Not enough credits"
          } else {
            this.numberPurchaseMessage = "Error purchasing number"
            console.log("Error buying number " + res.status)
          }
        }
      })
    },
    async userLogin() {
      this.getXMRAddress()
      this.getThreads(false)
      this.getCredits()
      await this.getOwnedNumber()

    },
    async getText(endpoint){
      let response = await fetch(this.backend + endpoint)
      if (! response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      } else {
        return response.text();
      }
    },
    formatPhone(phoneNumberString) {
        let cleaned = ('' + phoneNumberString).replace(/\D/g, '')
        let match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/)
        if (match) {
          return '(' + match[1] + ') ' + match[2] + '-' + match[3]
        }
        return null;
    },
    getCredits(){
      if (! this.userID || document.hidden){return}
      this.getText(this.userID + '/creditbal').then((data) => {
        this.credits = data
      }).catch((error) => {
        this.credits = 'Error getting credit balance'
      })
    },
    async getXMRAddress() {
      this.getText(this.userID + '/get_user_wallet').then((data) => {
        this.moneroAddress = data
      }).catch((error) => {
        this.moneroAddress = 'Error getting monero address'
      })
    },
    async getOwnedNumber() {
      return fetch(this.backend + this.userID + '/number').then((response) => {
        if (response.status == 402){
          this.ownedNumber = "No number owned"
        }
        else{
          response.text().then((num) => {
            this.ownedNumber = num
          })
        }
      }).catch((error) => {
        console.debug(error)
        this.ownedNumber = 'Error getting phone number'
      })
    },
    async showNumbers(e) {
      let req = await fetch(this.backend + 'availablenumbers')
      let numbers = await req.text()
      this.availableNumbers = numbers.replaceAll('\n\n', '').split('\n').map((number) => {
        return number
      })
    }
  },
  mounted() {
    // do this to get a connection to the backend so we don't have to wait for DNS later
    fetch(this.backend + 'ping')
    this.getThreads(true)
    setInterval(()=>{
      this.getThreadMessages(this.showingThreadNum)
    }, 5000)
    setInterval(()=>{
        this.getCredits()
    }, 30000)

  }
})
app.mount('#app')