/* globals process */
import path from 'path';
import axios from 'axios';
import xmlParser from 'fast-xml-parser';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();

const API_KEY = process.env.N_API_KEY ? process.env.N_API_KEY : 'default';
const DOMAIN = process.env.N_DOMAIN ? process.env.N_DOMAIN : '';
const SUB = process.env.N_SUB ? process.env.N_SUB : '';

const filename = path.join(process.cwd(), 'logs', 'log.txt');
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename }),
  ],
});

const main = async () => {
  let ip = null;
  let nasRecord = null;

  // 获取 ip
  try {
    const { data } = await axios.get('https://ipv6.icanhazip.com');
    ip = data.trim();
  } catch (err) {
    throw "获取 ip 失败";
  }
  throw '';

  // 获取 dns 记录列表
  try {
    const { data } = await axios.get(`https://www.namesilo.com/api/dnsListRecords?version=1&type=xml&key=${API_KEY}&domain=${DOMAIN}`, {
      responseType: 'text',
    });
    const { namesilo } = xmlParser.parse(data);
    if (+namesilo.reply.code !== 300 || namesilo.reply.detail !== 'success') {
      throw `获取 dns 记录失败: ${namesilo.reply.detail}(${namesilo.reply.code})`;
    }
    const records = namesilo.reply.resource_record;
    nasRecord = records.find((r) => r.host === `${SUB}.${DOMAIN}`);
    if (!nasRecord) {
      throw '没有指定的 dns 记录';
    }
  } catch (err) {
    throw err;
  }

  if (nasRecord.value !== ip) {
    // 设置 ip 的 dns
    try {
      const { data } = await axios.get(`https://www.namesilo.com/api/dnsUpdateRecord?version=1&type=xml&key=${API_KEY}&domain=${DOMAIN}&rrid=${nasRecord.record_id}&rrhost=${SUB}&rrvalue=${ip}&rrttl=3600`, {
        responseType: 'text',
      });
      const { namesilo } = xmlParser.parse(data);
      if (+namesilo.reply.code !== 300 || namesilo.reply.detail !== 'success') {
        throw `设置 dns 记录失败: ${namesilo.reply.detail}(${namesilo.reply.code})`;
      }
      logger.log('info', `dns 已设置为: ${ip}`, { time: new Date() });
    } catch (err) {
      throw '设置 dns 失败';
    }
  } else {
    logger.log('info', '记录 ip 相同', { time: new Date() });
  }
};

const intervalCall = () => {
  main().catch((err) => {
    logger.log('error', err, { time: new Date() });
  });
  setTimeout(() => {
    intervalCall();
  }, 30 * 60 * 1000);
};

intervalCall();
