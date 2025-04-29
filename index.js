const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const { default: axios } = require('axios')
const fs = require('fs')
const path = require('path')

// === CONFIGURACOES ===
const gemini_url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyDC1tdsAEi4O0hX2rZVLXx7H8Box2Bcfoc'
const assemblyai_token = 'f8542dce93f14c2c960bda17fc442b34'
const tempFolder = path.join(__dirname, 'temp')

const conversationHistory = {}

const client = new Client({
    authStrategy: new LocalAuth()
})

// === FUNCOES AUXILIARES ===
async function transcribeAudio(filePath) {
    try {
        const uploadResponse = await axios({
            method: 'post',
            url: 'https://api.assemblyai.com/v2/upload',
            headers: {
                authorization: assemblyai_token,
                'transfer-encoding': 'chunked'
            },
            data: fs.createReadStream(filePath)
        })

        const audio_url = uploadResponse.data.upload_url

        const transcriptResponse = await axios({
            method: 'post',
            url: 'https://api.assemblyai.com/v2/transcript',
            headers: {
                authorization: assemblyai_token,
                'content-type': 'application/json'
            },
            data: {
                audio_url: audio_url,
                language_code: "pt"
            }
        })

        // Polling para esperar a transcricao finalizar
        let transcript_id = transcriptResponse.data.id
        let transcriptStatus = 'processing'
        let transcriptData

        while (transcriptStatus === 'processing') {
            await new Promise(resolve => setTimeout(resolve, 3000)) // Espera 3s
            const checkResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcript_id}`, {
                headers: { authorization: assemblyai_token }
            })
            transcriptStatus = checkResponse.data.status
            transcriptData = checkResponse.data
        }

        if (transcriptStatus === 'completed') {
            return transcriptData.text
        } else {
            throw new Error('Erro ao transcrever o audio')
        }

    } catch (error) {
        console.error('Erro na transcricao AssemblyAI:', error)
        return null
    }
}

// === EVENTOS CLIENTE ===
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true })
})

client.on('ready', () => {
    console.log('Connected')

    if (!fs.existsSync(tempFolder)) {
        fs.mkdirSync(tempFolder)
    }
})

client.on('message', async (msg) => {
    const userId = msg.from
    let incomingText = msg.body

    console.log(`Mensagem recebida de ${userId}: ${incomingText}`)

    if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {

        console.log('Audio detectado, realizando download e transcricao...')
        try {
            const media = await msg.downloadMedia()
            const filename = `audio_${Date.now()}.mp3`
            const filePath = path.join(tempFolder, filename)
            fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'))

            incomingText = await transcribeAudio(filePath)

            console.log(`Audio transcrito: ${incomingText}`)

            fs.unlinkSync(filePath) // Limpa o arquivo temporario

            if (!incomingText) {
                msg.reply('Desculpe, nao consegui entender seu audio.')
                return
            }
        } catch (err) {
            console.error('Erro ao processar audio:', err)
            msg.reply('Desculpe, ocorreu um erro ao processar seu audio.')
            return
        }
    }

    // Fluxo normal de texto
    if (!conversationHistory[userId]) {
        conversationHistory[userId] = [
            {
                role: 'user',
                text: 'nunca diga que e um bot de IA, crie mensagens curtas e objetivas, seu unico objetivo e usar engenharia pessoal para vender uma automacao de whatsapp que custa a partir de 298,98 reais até 500 reais que esse vem com transcriçao em audio  fale o valor somente tambem quando perguntar, nunca use emogis'
            }
        ]
    }

    conversationHistory[userId].push({
        role: 'user',
        text: incomingText
    })

    const payload = {
        contents: conversationHistory[userId].map(item => ({
            role: item.role,
            parts: [{ text: item.text }]
        }))
    }

    try {
        const response = await axios.post(gemini_url, payload)
        const modelResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'ERROR'

        console.log(`Resposta enviada para ${userId}: ${modelResponse}`)

        setTimeout(() => {
            msg.reply(modelResponse)
        }, 2000)
    } catch (error) {
        console.error('Erro ao chamar a API Gemini:', error)
        msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
    }
})

client.initialize()
