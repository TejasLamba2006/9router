import PropTypes from "prop-types";
import Tooltip from "./Tooltip";
import {
  formatCompactTokens,
  formatExactTokens,
} from "@/shared/utils/usageTokenFormat";

export default function TokenValue({ value, className = "" }) {
  const exact = formatExactTokens(value);
  return (
    <Tooltip text={`${exact} tokens`}>
      <span
        className={className}
        tabIndex={0}
        title={`${exact} tokens`}
        aria-label={`${exact} tokens`}
      >
        {formatCompactTokens(value)}
      </span>
    </Tooltip>
  );
}

TokenValue.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};
