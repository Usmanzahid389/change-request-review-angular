import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrListComponent } from './cr-list.component';
import { SessionService } from '../../session/session.service';
import { CrApiService } from '../../api/cr-api.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(
	user: ReqUser,
	configure?: (api: CrApiService) => void,
): Promise<{ fixture: ComponentFixture<CrListComponent>; api: CrApiService }> {
	TestBed.configureTestingModule({
		imports: [CrListComponent],
		providers: [{ provide: SessionService, useValue: { user } }, CrApiService],
	});
	await TestBed.compileComponents();
	const api = TestBed.inject(CrApiService);
	configure?.(api);
	const fixture = TestBed.createComponent(CrListComponent);
	fixture.detectChanges();
	await flush();
	fixture.detectChanges();
	return { fixture, api };
}

describe('CrListComponent', () => {
	it('renders a row per change request in the user org', async () => {
		const { fixture } = await render(users.approver);
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3); // org-alpha: CR-1, CR-2, CR-3
	});

	it('shows the empty state when the org has no change requests', async () => {
		const { fixture } = await render({ id: 'x', orgCode: 'org-empty', policies: ['cr_r_o'] });
		expect(fixture.nativeElement.querySelector('.cr-list__empty')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();
	});

	it('shows loading then loaded state', async () => {
		TestBed.configureTestingModule({
			imports: [CrListComponent],
			providers: [{ provide: SessionService, useValue: { user: users.approver } }, CrApiService],
		});
		await TestBed.compileComponents();
		const api = TestBed.inject(CrApiService);
		api.latencyMs = 20;
		const fixture = TestBed.createComponent(CrListComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-list__loading')).not.toBeNull();
		await new Promise((r) => setTimeout(r, 30));
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-list__table')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__loading')).toBeNull();
	});

	it('shows the error state when the API fails', async () => {
		const { fixture } = await render(users.approver, (api) => {
			api.failNext = true;
		});
		expect(fixture.nativeElement.querySelector('.cr-list__error')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__error').textContent).toContain('Network error');
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();
	});

	it('narrows the table by status filter', async () => {
		const { fixture } = await render(users.approver);
		const select: HTMLSelectElement = fixture.nativeElement.querySelector('.cr-list__filter');
		select.value = 'PENDING_APPROVAL';
		select.dispatchEvent(new Event('change'));
		fixture.detectChanges();

		const rows: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.cr-list__row');
		expect(rows.length).toBe(1);
		expect(rows[0].textContent).toContain('CR-1');
		expect(fixture.componentInstance.visibleRows.every((r) => r.status === 'PENDING_APPROVAL')).toBe(true);
	});

	it('shows all rows again when filter is reset to ALL', async () => {
		const { fixture } = await render(users.approver);
		fixture.componentInstance.onFilterChange('DRAFT');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(1);

		fixture.componentInstance.onFilterChange('ALL');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3);
	});
});
