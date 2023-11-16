const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const csv = require('csv-parser');
const https = require('https');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const verificationChannelId = '824796147733626904'; 
const csvFileUrl = 'https://mydoornumber.co.uk/wp-content/plugins/orders-to-csv/orders_export.csv';

const usedOrdersFile = 'used_orders.csv'; 
const usedOrders = [];
const orders = [];

function createReadStream(file) {
  return fs.createReadStream(file).pipe(csv({ headers: ['orderNumber', 'used'] }));
}

async function downloadCSVFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest);
      reject(err.message);
    });
  });
}

async function processCSVFile(file, dataArray) {
  dataArray.length = 0;
  const stream = createReadStream(file);
  for await (const row of stream) {
    dataArray.push(row);
  }
  console.log(`${file} file successfully processed.`);
  console.log(`${file.charAt(0).toUpperCase() + file.slice(1, -4)}:`, dataArray);
}

async function updateOrders() {
  console.log('Downloading CSV file...');
  await downloadCSVFile(csvFileUrl, 'orders.csv');
  console.log('CSV file downloaded successfully.');
  await Promise.all([processCSVFile('orders.csv', orders), processCSVFile(usedOrdersFile, usedOrders)]);
}

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('verify')
      .setDescription('Verify your order with the provided order number.')
      .addStringOption(option =>
        option.setName('ordernumber')
          .setDescription('The order number for verification.')
          .setRequired(true)),
    async execute(interaction) {
      const orderNumber = interaction.options.getString('ordernumber');

      await processCSVFile(usedOrdersFile, usedOrders);

      const isValidOrder = await validateOrderNumber(orderNumber);

      if (isValidOrder) {

        const isOrderUsed = isOrderNumberUsed(orderNumber);

        if (!isOrderUsed) {

          markOrderAsUsed(orderNumber);

          const member = interaction.member;
          const role = interaction.guild.roles.cache.find((r) => r.name === 'OUTSPKN');

          if (role && member) {
            await member.roles.add(role);
            await interaction.reply({ content: 'You have been verified and granted access!', ephemeral: true });
          } else {
            await interaction.reply({ content: 'Verification failed. Please contact an admin.', ephemeral: true });
          }
        } else {
          await interaction.reply({ content: 'Order number already used. Please try a different one.', ephemeral: true });
        }
      } else {
        await interaction.reply({ content: 'Invalid order number. Please try again.', ephemeral: true });
      }
    },
  },
];

client.login('');

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.guilds.cache.forEach(guild => {
    guild.commands.set(commands.map(command => command.data));
  });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  const command = commands.find(cmd => cmd.data.name === commandName);

  if (command) {
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'An error occurred while processing your command.', ephemeral: true });
    }
  }
});

async function validateOrderNumber(orderNumber) {

  await processCSVFile('orders.csv', orders);
  return orders.some(order => order.orderNumber === orderNumber);
}

function isOrderNumberUsed(orderNumber) {
  const order = usedOrders.find(order => order.orderNumber === orderNumber);
  return order && order.used === '1';
}

function markOrderAsUsed(orderNumber) {
  const orderIndex = orders.findIndex(order => order.orderNumber === orderNumber);

  if (orderIndex !== -1) {

    orders[orderIndex].used = '1';

    usedOrders.push({ orderNumber, used: '1' });

    const csvDataUsedOrders = usedOrders.map(order => `${order.orderNumber},${order.used}`).join('\n');
    fs.writeFileSync(usedOrdersFile, `${csvDataUsedOrders}`, 'utf-8');

    console.log('Used orders file successfully updated with order marked as used');
  } else {
    console.error('Order not found in orders file:', orderNumber);
  }
}