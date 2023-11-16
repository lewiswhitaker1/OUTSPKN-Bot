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

const verificationChannelId = '824796147733626904'; // Replace with your verification channel ID
const csvFileUrl = 'https://mydoornumber.co.uk/wp-content/plugins/orders-to-csv/orders_export.csv';

const usedOrdersFile = 'used_orders.csv'; // New CSV file to keep track of used orders
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

      // Wait for the used orders to be processed
      await processCSVFile(usedOrdersFile, usedOrders);

      // Validate the order number against the local CSV file
      const isValidOrder = await validateOrderNumber(orderNumber);

      if (isValidOrder) {
        // Check if the order number has already been used
        const isOrderUsed = isOrderNumberUsed(orderNumber);

        if (!isOrderUsed) {
          // Mark the order number as used in the local CSV file
          markOrderAsUsed(orderNumber);

          // Grant access to the rest of the server
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

// Replace 'YOUR_BOT_TOKEN' with your actual bot token
client.login('MTE3NDM2NzE1MDk2Njg0OTYyNw.GgN91c.n7Z12370IMT18PC5fuLzm6BD1jHBuzowCV8gOk');

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

// Function to validate the order number against the local CSV file
async function validateOrderNumber(orderNumber) {
  // Wait for the orders to be processed
  await processCSVFile('orders.csv', orders);
  return orders.some(order => order.orderNumber === orderNumber);
}

// Function to check if the order number has already been used
function isOrderNumberUsed(orderNumber) {
  const order = usedOrders.find(order => order.orderNumber === orderNumber);
  return order && order.used === '1';
}

// Function to mark the order number as used in the local CSV file
function markOrderAsUsed(orderNumber) {
  const orderIndex = orders.findIndex(order => order.orderNumber === orderNumber);

  if (orderIndex !== -1) {
    // Mark the order as used in the orders array
    orders[orderIndex].used = '1';

    // Add the used order to the usedOrders array
    usedOrders.push({ orderNumber, used: '1' });

    // Write the updated data back to the used_orders CSV file
    const csvDataUsedOrders = usedOrders.map(order => `${order.orderNumber},${order.used}`).join('\n');
    fs.writeFileSync(usedOrdersFile, `${csvDataUsedOrders}`, 'utf-8');

    console.log('Used orders file successfully updated with order marked as used');
  } else {
    console.error('Order not found in orders file:', orderNumber);
  }
}
