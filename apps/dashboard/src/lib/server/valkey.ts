import { env } from '$env/dynamic/private';
import ValkeyClient from '@repo/valkey';

const client = new ValkeyClient(env.VALKEY_URL);

export default client;
