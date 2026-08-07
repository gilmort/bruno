import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'providers/Theme';
import MaskedValue from 'components/MaskedValue';

// Mock localStorage and matchMedia for ThemeProvider
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }))
  });
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(() => 'dark'),
      setItem: jest.fn(),
      removeItem: jest.fn()
    }
  });
});

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('MaskedValue', () => {
  it('should render label in badge', () => {
    renderWithTheme(
      <MaskedValue label="Category A" originalUuid="550e8400-e29b-41d4-a716-446655440000" />
    );

    const badge = screen.getByTestId('masked-uuid-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Category A');
  });

  it('should show tooltip on hover with original UUID', async () => {
    renderWithTheme(
      <MaskedValue label="Category A" originalUuid="550e8400-e29b-41d4-a716-446655440000" />
    );

    const badge = screen.getByTestId('masked-uuid-badge');
    fireEvent.mouseEnter(badge);

    const tooltip = screen.getByTestId('masked-uuid-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should hide tooltip on mouse leave', async () => {
    renderWithTheme(
      <MaskedValue label="Category A" originalUuid="550e8400-e29b-41d4-a716-446655440000" />
    );

    const badge = screen.getByTestId('masked-uuid-badge');
    fireEvent.mouseEnter(badge);

    expect(screen.getByTestId('masked-uuid-tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(badge);

    expect(screen.queryByTestId('masked-uuid-tooltip')).not.toBeInTheDocument();
  });

  it('should have copy button in tooltip', () => {
    renderWithTheme(
      <MaskedValue label="Category A" originalUuid="550e8400-e29b-41d4-a716-446655440000" />
    );

    const badge = screen.getByTestId('masked-uuid-badge');
    fireEvent.mouseEnter(badge);

    const copyBtn = screen.getByTestId('masked-uuid-copy-btn');
    expect(copyBtn).toBeInTheDocument();
    expect(copyBtn).toHaveTextContent('Copy');
  });

  it('should copy UUID to clipboard when copy button is clicked', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText }
    });

    renderWithTheme(
      <MaskedValue label="Category A" originalUuid="550e8400-e29b-41d4-a716-446655440000" />
    );

    const badge = screen.getByTestId('masked-uuid-badge');
    fireEvent.mouseEnter(badge);

    const copyBtn = screen.getByTestId('masked-uuid-copy-btn');
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should have all required data-testid attributes', () => {
    renderWithTheme(
      <MaskedValue label="Category A" originalUuid="test-uuid" />
    );

    expect(screen.getByTestId('masked-uuid-badge')).toBeInTheDocument();

    const badge = screen.getByTestId('masked-uuid-badge');
    fireEvent.mouseEnter(badge);

    expect(screen.getByTestId('masked-uuid-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('masked-uuid-copy-btn')).toBeInTheDocument();
  });
});

