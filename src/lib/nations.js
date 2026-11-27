const CODES = {
  Albania: 'AL', Algeria: 'DZ', Andorra: 'AD', Angola: 'AO', Argentina: 'AR', Armenia: 'AM', Australia: 'AU',
  Austria: 'AT', Barbados: 'BB', Belgium: 'BE', Benin: 'BJ', 'Bosnia and Herzegovina': 'BA', Brazil: 'BR',
  Bulgaria: 'BG', 'Burkina Faso': 'BF', Burundi: 'BI', Cameroon: 'CM', Canada: 'CA', 'Cape Verde Islands': 'CV',
  'Central African Republic': 'CF', Chile: 'CL', 'China PR': 'CN', Colombia: 'CO', Comoros: 'KM', Congo: 'CG',
  'Congo DR': 'CD', 'Costa Rica': 'CR', Croatia: 'HR', 'Curaçao': 'CW', Cyprus: 'CY', 'Czech Republic': 'CZ',
  "Côte d'Ivoire": 'CI', Denmark: 'DK', 'Dominican Republic': 'DO', Ecuador: 'EC', Egypt: 'EG', England: 'GB-ENG',
  'Equatorial Guinea': 'GQ', Estonia: 'EE', 'Faroe Islands': 'FO', Finland: 'FI', France: 'FR', Gabon: 'GA',
  Gambia: 'GM', Georgia: 'GE', Germany: 'DE', Ghana: 'GH', Greece: 'GR', Guinea: 'GN', 'Guinea-Bissau': 'GW',
  Haiti: 'HT', Holland: 'NL', Hungary: 'HU', Iceland: 'IS', Indonesia: 'ID', Iraq: 'IQ', Israel: 'IL', Italy: 'IT',
  Jamaica: 'JM', Japan: 'JP', Jordan: 'JO', Kazakhstan: 'KZ', Kenya: 'KE', 'Korea Republic': 'KR', Kosovo: 'XK',
  Latvia: 'LV', Lebanon: 'LB', Libya: 'LY', Lithuania: 'LT', Luxembourg: 'LU', Madagascar: 'MG', Malawi: 'MW',
  Mali: 'ML', Malta: 'MT', Mauritania: 'MR', Mexico: 'MX', Moldova: 'MD', Montenegro: 'ME', Morocco: 'MA',
  Mozambique: 'MZ', Namibia: 'NA', 'New Zealand': 'NZ', Niger: 'NE', Nigeria: 'NG', 'North Macedonia': 'MK',
  'Northern Ireland': 'GB-NIR', Norway: 'NO', Panama: 'PA', Paraguay: 'PY', Peru: 'PE', Philippines: 'PH',
  Poland: 'PL', Portugal: 'PT', Qatar: 'QA', 'Republic of Ireland': 'IE', Romania: 'RO', Russia: 'RU',
  'Saudi Arabia': 'SA', Scotland: 'GB-SCT', Senegal: 'SN', Serbia: 'RS', 'Sierra Leone': 'SL', Slovakia: 'SK',
  Slovenia: 'SI', 'South Africa': 'ZA', Spain: 'ES', 'St. Lucia': 'LC', Suriname: 'SR', Sweden: 'SE',
  Switzerland: 'CH', Syria: 'SY', Tanzania: 'TZ', Thailand: 'TH', Togo: 'TG', 'Trinidad and Tobago': 'TT',
  Tunisia: 'TN', Turkey: 'TR', Uganda: 'UG', Ukraine: 'UA', 'United Arab Emirates': 'AE', 'United States': 'US',
  Uruguay: 'UY', Uzbekistan: 'UZ', Venezuela: 'VE', Wales: 'GB-WLS', Zambia: 'ZM', Zimbabwe: 'ZW',
}

const SPECIAL = { 'GB-ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'GB-SCT': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'GB-WLS': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'GB-NIR': '🇬🇧' }

export function flagEmoji(nation) {
  const code = CODES[nation]
  if (!code) return '🌍'
  if (SPECIAL[code]) return SPECIAL[code]
  return code.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

export function nationCode(nation) {
  return CODES[nation] || null
}

export const NATIONS = Object.keys(CODES).sort()
