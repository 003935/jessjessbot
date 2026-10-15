<script lang="ts">
	import Calendar from '$lib/components/ui/calendar/calendar.svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { getLocalTimeZone } from '@internationalized/date';
	import { CalendarDate } from '@internationalized/date';

	const id = $props.id();

	let { value, onValueChange }: { value?: string; onValueChange: (v: string) => void } = $props();

	let open = $state(false);

	// svelte-ignore state_referenced_locally
	const currentDate = value ? new Date(value) : new Date();

	let date = $state<CalendarDate>(
		new CalendarDate(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate())
	);
	let time = $state<string>(
		`${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')}`
	);

	$inspect(time);

	$effect(() => {
		const [hours, minutes, seconds] = time.split(':').map((t) => parseInt(t));
		const new_date = new Date(date.year, date.month - 1, date.day, hours, minutes, seconds);
		onValueChange(new_date.toISOString());
	});
</script>

<div class="flex gap-4">
	<Popover.Root bind:open>
		<Popover.Trigger id="{id}-date">
			{#snippet child({ props })}
				<Button {...props} variant="outline" class="w-32 justify-between font-normal">
					{date ? date.toDate(getLocalTimeZone()).toLocaleDateString() : 'Select date'}
					<ChevronDownIcon />
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-auto overflow-hidden p-0" align="start">
			<Calendar
				type="single"
				bind:value={date}
				onValueChange={() => {
					open = false;
				}}
				captionLayout="dropdown"
			/>
		</Popover.Content>
	</Popover.Root>
	<Input
		type="time"
		id="{id}-time"
		step="1"
		class="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
		bind:value={time}
	/>
</div>
