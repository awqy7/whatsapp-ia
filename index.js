const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const { default: axios } = require('axios')

const gemini_url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyDC1tdsAEi4O0hX2rZVLXx7H8Box2Bcfoc'

const conversationHistory = {}

const client = new Client({
    authStrategy: new LocalAuth()
})

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true })
})

client.on('ready', () => {
    console.log('Connected')
})

client.on('message', async (msg) => {
    const userId = msg.from

    console.log(`Mensagem recebida de ${userId}: ${msg.body}`) // Log da mensagem recebida

    if (!conversationHistory[userId]) {
        conversationHistory[userId] = [
            {
                role: 'user',
                text: 'Eu quero que você seja um assistente muito humanizado e que mande mensagens curtas e certas e nunca fale que voce e uma IA seu link de venda e esse "loja.infinitepay.io/telhadoenergiasolar" , use engenharia social e qualquer problema atedemos ele resolsa o prblema dando direcionando sempre para a  concluir  a venda nao aja jamais em terceira pessoa aja como dono responsavel por tudo, use menos emojis'
            }
        ]
    }

    conversationHistory[userId].push({
        role: 'user',
        text: msg.body
    })

    const payload = {
        contents: conversationHistory[userId].map(item => ({
            role: item.role,
            parts: [{ text: item.text }]
        }))
    }

    try {
        const response = await axios.post(gemini_url, payload)
        const modelResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "ERROR"

        console.log(`Resposta enviada para ${userId}: ${modelResponse}`) // Log da resposta enviada
        msg.reply(modelResponse) // Envia a resposta ao usuário no WhatsApp
    } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error)
        msg.reply("Desculpe, ocorreu um erro ao processar sua mensagem.")
    }
})

client.initialize()
