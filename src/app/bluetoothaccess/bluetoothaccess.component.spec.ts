import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BluetoothaccessComponent } from './bluetoothaccess.component';

describe('BluetoothaccessComponent', () => {
  let component: BluetoothaccessComponent;
  let fixture: ComponentFixture<BluetoothaccessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BluetoothaccessComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BluetoothaccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
