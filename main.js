const { createApp } = Vue


let app = createApp({
  computed: {
    randomID: () => function(){
      let buf2hex = function(buffer) { // buffer is an ArrayBuffer
        return [...new Uint8Array(buffer)]
            .map(x => x.toString(16).padStart(2, '0'))
            .join('');
      }
      return buf2hex(window.crypto.getRandomValues(new Uint8Array(25)))
      },
    onLine: () => window.navigator.onLine
  },
  data() {
    return {
      userIDInput: '',
      userID: "",
      showUserID: "",
      backend: 'https://api.monerosms.com/',
      availableNumbers: [],
      credits: "",
      threads: [],
      ownedNumber: "Getting number...",
      numberPurchaseMessage: "",
      moneroAddress: 'Getting monero address...',
      darkMode: true,
      disableSMSSend: false,
      messageToSend: "",
      sendMsgErr: "",
      sendToNumber: "",
      showingThreadNum: "",
      threadOffset: 0,
      threadMessages: [],
      lastThreadLineHeader: 0,
      threadLineHeader: 0,
      pricingInfo: "",
      email: 0,
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

        let fromUs = "from-us"
        let applyBreak = false

        messages = messages.split('\n')
        if (messages.length > 0){
          for (let i = 0; i < messages.length; i++){
            applyBreak = false
            fromUs = fromUs.replaceAll(" msgBreak", "")
            if (messages[i] !== ''){


              if (messages[i].startsWith(this.ownedNumber)){
                fromUs = "from-us"
                messages[i] = messages[i].replace(this.ownedNumber, this.formatPhone(this.ownedNumber))
                applyBreak = true
              }
              else if(messages[i].startsWith(this.showingThreadNum)){
                fromUs = "from-them"
                messages[i] = messages[i].replace(this.showingThreadNum, this.formatPhone(this.showingThreadNum))
                applyBreak = true
              }

              if (applyBreak){
                fromUs += " msgBreak"
              }

              console.debug(messages[i] + " " + fromUs)
              this.threadMessages.push([messages[i], fromUs])

            }
          }
          this.threadOffset = this.threadLineHeader
        }
      })
    },
    sendSMS(){
      if (! this.onLine){
        this.sendMsgErr = "You are offline, cannot send message"
        return
      }
      this.sendMsgErr = ""
      this.disableSMSSend = true
      fetch(this.backend + this.userID + '/send/' + this.sendToNumber, {
        method: 'POST',
        body: this.messageToSend
      }).then(resp => {
        this.disableSMSSend = false
        if (resp.status === 200) {
          this.messageToSend = ""
          this.getThreads()
          this.getThreadMessages()
        }
        else{
          resp.text().then(text => {
            this.sendMsgErr = text
            console.debug(text)
        })
        }
      }).catch(err => {
        this.disableSMSSend = false
        this.sendMsgErr = err.toString()
        console.log(err)
      })
      return false
    },
    async isUsingEmail(){
      fetch(this.backend + this.userID + '/usingemail').then(response => {
        if (response.ok) {
          return response.text()
        } else {
          throw new Error('Network response was not ok.')
        }
      }).then(email => {
        if (email === "1"){
          this.email = 1
        }
        else{
          this.email = 0
        }
      })
    },
    setEmail(){
      if (! this.onLine){
        alert("You are offline, cannot set email")
        return
      }
      let email = prompt("Enter your email address for email relaying.\nLeave blank or cancel to disable email relaying.")
      if (! this.onLine){
        alert("You are offline, cannot set email")
        return
      }
      if (email === null){
        email = "none"
      }
      else{
        email = email.trim()
        if (email === ""){
          email = "none"
        }
        else{
          if (! RegExp('@').test(email)){
            alert("Invalid email address")
            return
          }
        }
      }
      fetch(this.backend + this.userID + '/setemail/' + email, {
        method: 'POST'
      }).then(resp => {
        if (resp.status === 200) {

          if (email === "none"){
            this.email = 0
            alert("Email disabled. You will see new messages in the UI")
          }
          else{
            this.email = 1
            alert("Email set to " + email + ". You will not see new messages in this UI.")
          }
        }
        else{
          resp.text().then(text => {
            alert(text)
            console.debug(text)
        })
        }
      }).catch(err => {
        alert(err.toString())
        console.log(err)
      })
    },
    getThreads(doInterval){
      let updateThreads = async (data) => {
        if (! this.userID || document.hidden){
          return
        }
        let response = await fetch(this.backend + this.userID + '/list')
        if (response.ok){
          let textResp = await response.text()
          if (RegExp('No').test(textResp)){
            this.threads.length = 0
            return
          }
          if (! RegExp('You').test(textResp)){
            // Only update threads that changed
            let newThreads = textResp.split('\n')
            for (let i = 0; i < newThreads.length; i++){
              newThreads[i] = newThreads[i].trim()
              if (! this.threads.includes(newThreads[i])){
                if (newThreads[i]){
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
    deleteThread(num){
      let choice = confirm("Are you sure you want to delete this thread?")
      if (! choice){
        return
      }

      fetch(this.backend + this.userID + '/delete/' + num, {'method': 'POST'}).catch((err) => {
        alert("Failed to delete thread. Please report if this keeps occurring.")
      }).then((res) =>{
        if (! res.ok){
          alert("Failed to delete thread. Please report if this keeps occurring.")
          return
        }
        this.getThreads(false)
      })
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
          this.getCredits()
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
      if (! this.onLine){
        alert("You are offline, cannot login")
        return
      }
      if (this.userID.length > 100){
        alert("User ID too long")
        return
      }
      if (this.userID.length < 8){
        alert("User ID too short")
        return
      }
      if (RegExp(' ').test(this.userID)){
        alert("User ID cannot contain spaces")
        return
      }
      this.isUsingEmail()
      this.getXMRAddress()
      this.getThreads(false)
      this.getCredits()
      this.getPricingInfo()
      await this.getOwnedNumber()
      if (this.ownedNumber.startsWith("No")) {
        this.showNumbers()
      }
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
    async getCredits(){
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
      try {
        const req = await fetch(this.backend + 'availablenumbers');
        const numbersText = await req.text();

        this.availableNumbers = numbersText.split('\n').filter(number => {
          return typeof number === 'string' && number.trim().length > 0;
        });
      } catch (error) {
        console.error("Error fetching or processing numbers:", error);
      }
    },
    async getPricingInfo(){
      fetch (this.backend + 'pricing').then((response) => {
        if (! response.ok){
          this.pricingInfo = "Error getting pricing info"
        }
        else{
          response.text().then((data) => {
            this.pricingInfo = data
          })
        }
      }).catch((error) => {
        this.pricingInfo = "Error getting pricing info"
        console.debug(error)
      })
    }
  },
  mounted() {

    // do this to get a connection to the backend so we don't have to wait for DNS later
    if (document.location.hostname.endsWith(".onion")){
      this.backend = "http://api.xmr4smsoncunkfgfjr6xmxl57afsmuu6rg2bwuysbgg4wdtoawamwxad.onion/"
    }
    fetch(this.backend + 'ping')
    this.getThreads(true)
    setInterval(()=>{
      this.getThreadMessages(this.showingThreadNum)
    }, 5000)
    setInterval(()=>{
        this.getCredits()
        this.getPricingInfo()
    }, 30000)

  }
})
app.mount('#app')