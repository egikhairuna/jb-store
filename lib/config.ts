const getEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    console.warn(`Warning: Environment variable ${key} is not defined.`);
  }
  return value || "";
};

export const wcConfig = {
  url: getEnv("WC_URL"),
  consumerKey: getEnv("WC_CONSUMER_KEY"),
  consumerSecret: getEnv("WC_CONSUMER_SECRET"),
}
