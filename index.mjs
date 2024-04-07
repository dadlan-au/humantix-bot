import { Routes, REST, Client, GatewayIntentBits, bold } from 'discord.js'
const commands = [
	{
		name: 'humantix',
		description: 'Retrieve active Humantix tickets',
	},
]
async function registerCommands() {
	const rest = new REST({ version: '9' }).setToken(
		process.env.DISCORD_BOT_TOKEN
	)
	try {
		console.log('Started refreshing application (/) commands.')
		await rest.put(
			Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID),
			{ body: commands }
		)

		console.log('Successfully reloaded application (/) commands.')
	} catch (error) {
		console.error(error)
	}
}

const getTicketsForEvent = async (eventId) => {
	const { tickets } = await fetch(`https://api.humanitix.com/v1/events/${eventId}/tickets?page=1&pageSize=100`, {
		headers: {
			"X-Api-Key": process.env.HUMANTIX_API_KEY
		}
	}).then(response => response.json());
	return tickets;

}

const getEvents = async () => {

	const { events } = await fetch("https://api.humanitix.com/v1/events?page=1&pageSize=100&inFutureOnly=true", {
		headers: {
			"X-Api-Key": process.env.HUMANTIX_API_KEY
		}
	}).then(response => response.json());

	return Promise.all(events.map(async humantixEvent => {
		
		const tickets = await getTicketsForEvent(humantixEvent._id);

		if(humantixEvent.slug.startsWith("dadlan-remote")) {
			return {
				name: humantixEvent.name,
				ordersCount: tickets.length,
				isRemote: true
			}
		}

		const spareLaptopQuestionId = humantixEvent.additionalQuestions.find(x => x.question === "Do you need to borrow a laptop?")._id;

		return {
			name: humantixEvent.name,
			ordersCount: tickets.length,
			contributions: tickets.reduce((acc, ticket) => acc + ticket.netPrice, 0),
			sparesNeeded: tickets.reduce((acc, ticket) => acc + (ticket.additionalFields.find(x => x.questionId === spareLaptopQuestionId).value === "Yes" ? 1 : 0), 0)
		}

	}));

}

const startBot = async () => {
	const client = new Client({
		intents: [GatewayIntentBits.Guilds],
	})

	client.once('ready', async () => {
		console.log(`Logged in as ${client.user.tag}!`)
	})

	client.on('interactionCreate', async (interaction) => {
		if (!interaction.isCommand()) return

		if (interaction.commandName === 'humantix') {
			
			const events = await getEvents();
            
			await interaction.reply(`
				${events.map(event => event.isRemote ? `${bold(event.name)}\nOrders: ${event.ordersCount}` : `${bold(event.name)}\nOrders: ${event.ordersCount}\nContributions: $${event.contributions}\nSpares needed: ${event.sparesNeeded}`).join('\n\n')}`);
		}
	})

	client.login(process.env.DISCORD_BOT_TOKEN)
}

registerCommands()
startBot()