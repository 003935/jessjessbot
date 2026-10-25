/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { detailsForPrompt, isGreeting } from '../src/modules/mention-details';

const base = {
	likes: [],
	dislikes: [],
	pets: ['cheesy (cat)'],
	birthday: '19 Oct',
	favourites: [],
	notes: ['plays nilah'],
};

test('pets dropped from unrelated chat', () => {
	expect(detailsForPrompt('jjb who wins worlds', base, { petChannel: false })!.pets).toEqual([]);
});

test('pets kept when asked about, by name, or in #pet', () => {
	expect(detailsForPrompt('jjb whats my cats name', base, { petChannel: false })!.pets).toEqual(['cheesy (cat)']);
	expect(detailsForPrompt('cheesy is being weird', base, { petChannel: false })!.pets).toEqual(['cheesy (cat)']);
	expect(detailsForPrompt('look', base, { petChannel: true })!.pets).toEqual(['cheesy (cat)']);
});

test('a pet name inside a longer word does not count', () => {
	expect(detailsForPrompt('cheesycake time', base, { petChannel: false })!.pets).toEqual([]);
});

test('greetings only sometimes carry pets', () => {
	expect(detailsForPrompt('hola', base, { petChannel: false, random: () => 0.9 })!.pets).toEqual([]);
	expect(detailsForPrompt('hola', base, { petChannel: false, random: () => 0.1 })!.pets).toEqual(['cheesy (cat)']);
});

test('birthday only when relevant; null when nothing left', () => {
	expect(detailsForPrompt('jjb who wins worlds', base, { petChannel: false })!.birthday).toBeNull();
	expect(detailsForPrompt('when is my bday', base, { petChannel: false })!.birthday).toBe('19 Oct');
	expect(detailsForPrompt('yo', { ...base, notes: [] }, { petChannel: false, random: () => 0.9 })).toBeNull();
	expect(detailsForPrompt('yo', null, { petChannel: false })).toBeNull();
});

test('isGreeting knows hola', () => {
	expect(isGreeting('hola')).toBe(true);
	expect(isGreeting('hola what is the time')).toBe(false);
});
