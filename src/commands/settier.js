const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// Yaha apne server ke tier role ki IDs daal (role pe right click → Copy Role ID)
const TIER_ROLES = {
  HT1: 'ROLE_ID_HT1',
  LT1: 'ROLE_ID_LT1',
  HT2: 'ROLE_ID_HT2',
  LT2: 'ROLE_ID_LT2',
  HT3: 'ROLE_ID_HT3',
  LT3: 'ROLE_ID_LT3',
  HT4: 'ROLE_ID_HT4',
  LT4: 'ROLE_ID_LT4',
  HT5: 'ROLE_ID_HT5',
  LT5: 'ROLE_ID_LT5',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settier')
    .setDescription('Kisi member ko tier do')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o =>
      o.setName('member').setDescription('Jisko tier dena hai').setRequired(true))
    .addStringOption(o =>
      o.setName('tier')
        .setDescription('Konsa tier')
        .setRequired(true)
        .addChoices(...Object.keys(TIER_ROLES).map(t => ({ name: t, value: t })))),

  async execute(interaction) {
    const member = interaction.options.getMember('member');
    const tier = interaction.options.getString('tier');

    if (!member) {
      return interaction.reply({ content: 'Member server me nahi mila.', ephemeral: true });
    }

    const newRoleId = TIER_ROLES[tier];

    try {
      // Purane tier roles hatao
      const oldRoles = Object.values(TIER_ROLES).filter(id => member.roles.cache.has(id));
      if (oldRoles.length) await member.roles.remove(oldRoles);

      // Naya tier role do
      await member.roles.add(newRoleId);

      await interaction.reply(`${member} ko **${tier}** tier mil gaya ✅`);
    } catch (err) {
      console.error(err);
      await interaction.reply({
        content: 'Role nahi de paya. Bot ka role tier roles ke upar hona chahiye aur Manage Roles permission honi chahiye.',
        ephemeral: true,
      });
    }
  },
};
